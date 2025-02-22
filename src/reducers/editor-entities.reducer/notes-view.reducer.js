import { combineReducers } from 'redux';
import { createSelector } from 'reselect';
import undoable, { includeAction, groupByActionTypes } from 'redux-undo';
import produce from 'immer';

import { NOTES_VIEW, SURFACE_DEPTH } from '../../constants';
import {
  findNoteIndexByProperties,
  swapNotes,
  calculateNoteDensity,
} from '../../helpers/notes.helpers';
import { swapObstacles } from '../../helpers/obstacles.helpers';
import { getCursorPositionInBeats, getBeatDepth } from '../navigation.reducer';
import { getSelectedSong } from '../songs.reducer';

const initialState = {
  notes: [],
  obstacles: [],
};

const getItemType = item => {
  switch (item) {
    case 'red-block':
      return 0;
    case 'blue-block':
      return 1;
    case 'mine':
      return 3;
    default: {
      throw new Error('Unrecognized item: ' + item);
    }
  }
};

const notes = (state = initialState.notes, action) => {
  switch (action.type) {
    case 'CREATE_NEW_SONG':
    case 'START_LOADING_SONG':
    case 'CLEAR_ENTITIES': {
      return initialState.notes;
    }

    case 'LOAD_BEATMAP_ENTITIES': {
      return action.notes || [];
    }

    case 'CLICK_PLACEMENT_GRID': {
      const {
        rowIndex,
        colIndex,
        cursorPositionInBeats,
        selectedDirection,
        selectedTool,
      } = action;

      // Make sure there isn't already a note in this location.
      const alreadyExists = state.some(
        note =>
          note._time === cursorPositionInBeats &&
          note._lineIndex === colIndex &&
          note._lineLayer === rowIndex
      );

      if (alreadyExists) {
        console.warn('Tried to add a double-note in the same spot. Rejected.');
        return state;
      }

      return [
        ...state,
        {
          _time: cursorPositionInBeats,
          _lineIndex: colIndex,
          _lineLayer: rowIndex,
          _type: getItemType(selectedTool),
          _cutDirection: selectedDirection,
        },
      ];
    }

    case 'SET_BLOCK_BY_DRAGGING': {
      // This action is very similar to `CLICK_PLACEMENT_GRID`, except the
      // direction is determined by the mouse position. Because of this, as the
      // user moves the mouse, the direction changes, and so the block needs
      // to be replaced. While in `CLICK_PLACEMENT_GRID` we ignore duplicate
      // blocks, in this case we need to swap it out.
      const {
        direction,
        rowIndex,
        colIndex,
        cursorPositionInBeats,
        selectedTool,
      } = action;

      const existingBlockIndex = state.findIndex(
        note =>
          note._time === cursorPositionInBeats &&
          note._lineIndex === colIndex &&
          note._lineLayer === rowIndex
      );

      const newBlock = {
        _time: cursorPositionInBeats,
        _lineIndex: colIndex,
        _lineLayer: rowIndex,
        _type: getItemType(selectedTool),
        _cutDirection: direction,
      };

      if (existingBlockIndex === -1) {
        return [...state, newBlock];
      }

      return [
        ...state.slice(0, existingBlockIndex),
        newBlock,
        ...state.slice(existingBlockIndex + 1),
      ];
    }

    case 'DELETE_NOTE':
    case 'BULK_DELETE_NOTE': {
      const noteIndex = findNoteIndexByProperties(state, action);

      if (noteIndex === -1) {
        // This shouldn't be possible, but if it does somehow happen, it
        // shouldn't crash everything.
        return state;
      }

      return [...state.slice(0, noteIndex), ...state.slice(noteIndex + 1)];
    }

    case 'DELETE_SELECTED_NOTES': {
      return state.filter(note => !note.selected);
    }

    case 'CUT_SELECTION': {
      if (action.view !== NOTES_VIEW) {
        return state;
      }

      return state.filter(note => !note.selected);
    }

    case 'PASTE_SELECTION': {
      const { pasteAtBeat, view, data } = action;

      if (view !== NOTES_VIEW || data.length === 0) {
        return state;
      }

      /*
        The notes that I copied have their time (in beats) from the origin 0.00.
        It might look like:

        [
          { "_time": 34, "_type": 3, "_value": 7 },
          { "_time": 34, ...snip },
          { "_time": 39, ...snip },
          { "_time": 40, ...snip },
        ]

        We need to reset all of the _time values to be based from the current
        cursor position. If we're at beat #44, we need to shift them all forward
        by 10 beats.

        Do the same thing for obstacles.
      */

      // The tricky thing here is that the clipboard contains intermingled
      // notes/mines and obstacles, and their data format is different.
      const isBlockOrMine = item => typeof item._cutDirection === 'number';

      const earliestBeat = isBlockOrMine(data[0])
        ? data[0]._time
        : data[0].beatStart;
      const deltaBetweenPeriods = pasteAtBeat - earliestBeat;

      // When pasting a selection, we want to DESELECT all other notes.
      // Otherwise, it's easy to forget that you have actively-selected notes
      // somewhere else in the project.
      const deselectedState = state.map(note => ({
        ...note,
        selected: false,
      }));

      const notes = data.filter(isBlockOrMine);

      const timeShiftedNotes = notes.map(note => ({
        ...note,
        selected: true,
        _time: note._time + deltaBetweenPeriods,
      }));

      return [...deselectedState, ...timeShiftedNotes];
    }

    case 'TOGGLE_NOTE_COLOR': {
      const noteIndex = findNoteIndexByProperties(state, action);

      const note = state[noteIndex];

      // If this is a mine, do nothing
      if (note._type > 1) {
        return state;
      }

      return [
        ...state.slice(0, noteIndex),
        {
          ...note,
          _type: note._type === 0 ? 1 : 0,
        },
        ...state.slice(noteIndex + 1),
      ];
    }

    case 'SELECT_NOTE':
    case 'DESELECT_NOTE': {
      const noteIndex = findNoteIndexByProperties(state, action);

      const selected = action.type === 'SELECT_NOTE';

      if (noteIndex === -1) {
        // This shouldn't be possible, but if it does somehow happen, it
        // shouldn't crash everything.
        return state;
      }

      const note = state[noteIndex];

      return [
        ...state.slice(0, noteIndex),
        {
          ...note,
          selected,
        },
        ...state.slice(noteIndex + 1),
      ];
    }

    case 'SELECT_ALL': {
      if (action.view !== NOTES_VIEW) {
        return state;
      }
      return state.map(note => ({
        ...note,
        selected: true,
      }));
    }
    case 'DESELECT_ALL': {
      if (action.view !== NOTES_VIEW) {
        return state;
      }
      return state.map(note => ({
        ...note,
        selected: false,
      }));
    }

    case 'SWAP_SELECTED_NOTES': {
      const { axis } = action;
      return swapNotes(axis, state);
    }

    default:
      return state;
  }
};

const obstacles = (state = initialState.obstacles, action) => {
  switch (action.type) {
    case 'CREATE_NEW_SONG':
    case 'START_LOADING_SONG':
    case 'CLEAR_ENTITIES': {
      return [];
    }

    case 'LOAD_BEATMAP_ENTITIES': {
      return action.obstacles || [];
    }

    case 'CREATE_NEW_OBSTACLE': {
      const { obstacle } = action;

      return [...state, obstacle];
    }

    case 'RESIZE_OBSTACLE': {
      const { id, newBeatDuration } = action;

      const obstacleIndex = state.findIndex(o => o.id === id);

      return produce(state, draftState => {
        const obstacle = draftState[obstacleIndex];
        obstacle.beatDuration = newBeatDuration;
      });
    }

    case 'DELETE_OBSTACLE': {
      return state.filter(obstacle => obstacle.id !== action.id);
    }

    case 'DELETE_SELECTED_NOTES': {
      return state.filter(obstacle => !obstacle.selected);
    }

    case 'CUT_SELECTION': {
      if (action.view !== NOTES_VIEW) {
        return state;
      }

      return state.filter(obstacle => !obstacle.selected);
    }
    case 'PASTE_SELECTION': {
      const { pasteAtBeat, view, data } = action;

      if (view !== NOTES_VIEW || data.length === 0) {
        return state;
      }

      // See PASTE_SELECTION in the above notes reducer to understand what's
      // going on here.
      const isObstacle = item => typeof item._cutDirection === 'undefined';

      const earliestBeat = isObstacle(data[0])
        ? data[0].beatStart
        : data[0]._time;
      const deltaBetweenPeriods = pasteAtBeat - earliestBeat;

      // When pasting a selection, we want to DESELECT all other notes.
      // Otherwise, it's easy to forget that you have actively-selected notes
      // somewhere else in the project.
      const deselectedState = state.map(obstacle => ({
        ...obstacle,
        selected: false,
      }));
      const obstacles = data.filter(isObstacle);

      const timeShiftedObstacles = obstacles.map(obstacle => ({
        ...obstacle,
        selected: true,
        beatStart: obstacle.beatStart + deltaBetweenPeriods,
      }));

      return [...deselectedState, ...timeShiftedObstacles];
    }

    case 'SELECT_OBSTACLE': {
      const { id } = action;
      const obstacleIndex = state.findIndex(o => o.id === id);

      return produce(state, draftState => {
        draftState[obstacleIndex].selected = true;
      });
    }
    case 'DESELECT_OBSTACLE': {
      const { id } = action;
      const obstacleIndex = state.findIndex(o => o.id === id);

      return produce(state, draftState => {
        draftState[obstacleIndex].selected = false;
      });
    }

    case 'SWAP_SELECTED_NOTES': {
      const { axis } = action;
      return swapObstacles(axis, state);
    }

    default:
      return state;
  }
};

const notesView = undoable(combineReducers({ notes, obstacles }), {
  limit: 100,
  undoType: 'UNDO_NOTES',
  redoType: 'REDO_NOTES',
  filter: includeAction([
    'FINISH_LOADING_SONG',
    'CLICK_PLACEMENT_GRID',
    'SET_BLOCK_BY_DRAGGING',
    'DELETE_NOTE',
    'BULK_DELETE_NOTE',
    'DELETE_SELECTED_NOTES',
    'CUT_SELECTION',
    'PASTE_SELECTION',
    'CREATE_NEW_OBSTACLE',
    'RESIZE_OBSTACLE',
    'DELETE_OBSTACLE',
    'SWAP_SELECTED_NOTES',
    'TOGGLE_NOTE_COLOR',
  ]),
  groupBy: groupByActionTypes(['BULK_DELETE_NOTE']),
});

//
//
// Selectors
//

export const getNotes = state => state.editorEntities.notesView.present.notes;
export const getEvents = state => [];
export const getObstacles = state =>
  state.editorEntities.notesView.present.obstacles;

export const getSelectedNotes = createSelector(
  getNotes,
  notes => {
    return notes.filter(note => note.selected);
  }
);
export const getSelectedObstacles = createSelector(
  getObstacles,
  obstacles => {
    return obstacles.filter(obstacle => obstacle.selected);
  }
);

export const getSelectedNotesAndObstacles = createSelector(
  getSelectedNotes,
  getSelectedObstacles,
  (notes, obstacles) => [...notes, ...obstacles]
);

export const getNumOfBlocks = createSelector(
  getNotes,
  notes => {
    return notes.filter(note => note._type === 0 || note._type === 1).length;
  }
);
export const getNumOfMines = createSelector(
  getNotes,
  notes => {
    return notes.filter(note => note._type === 3).length;
  }
);
export const getNumOfObstacles = state => getObstacles(state).length;

export const getNumOfSelectedNotes = state => {
  return getSelectedNotes(state).length + getSelectedObstacles(state).length;
};

export const getVisibleNotes = createSelector(
  getNotes,
  getCursorPositionInBeats,
  getBeatDepth,
  (notes, cursorPositionInBeats, beatDepth) => {
    const farLimit = SURFACE_DEPTH / beatDepth;
    const closeLimit = (SURFACE_DEPTH / beatDepth) * 0.2;

    return notes.filter(note => {
      return (
        note._time > cursorPositionInBeats - closeLimit &&
        note._time < cursorPositionInBeats + farLimit
      );
    });
  }
);

export const getNoteDensity = createSelector(
  getVisibleNotes,
  getCursorPositionInBeats,
  getBeatDepth,
  getSelectedSong,
  (notes, cursorPositionInBeats, beatDepth, song) => {
    const { bpm } = song;
    const segmentLengthInBeats = (SURFACE_DEPTH / beatDepth) * 1.2;

    return calculateNoteDensity(notes.length, segmentLengthInBeats, bpm);
  }
);

export default notesView;
