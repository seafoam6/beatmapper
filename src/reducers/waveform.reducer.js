const initialState = {
  data: null,
  zoomAmount: 0,
  zoomCursorPosition: null,
};

export default function songReducer(state = initialState, action) {
  switch (action.type) {
    case 'UNLOAD_SONG': {
      return {
        ...state,
        // Don't show stale data from previously-loaded songs
        data: null,
      };
    }

    case 'FINISH_LOADING_SONG': {
      const { waveformData } = action;

      return {
        ...state,
        data: waveformData,
        zoomAmount: 0,
        zoomCursorPosition: null,
      };
    }

    case 'ZOOM_WAVEFORM': {
      let newWaveformZoom = state.waveformZoom + action.amount;

      // `0` is the default zoom, which means that there's 0% zoom.
      // We don't want to allow negative zoom.
      // I might also want to add a max zoom, but I'm gonna wait and see on
      // that.
      newWaveformZoom = Math.max(newWaveformZoom, 0);

      return {
        ...state,
        waveformZoom: newWaveformZoom,
      };
    }

    case 'LEAVE_EDITOR': {
      return initialState;
    }

    default:
      return state;
  }
}
