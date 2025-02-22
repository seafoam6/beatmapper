import React from 'react';
import * as THREE from 'three';

import {
  BLOCK_COLUMN_WIDTH,
  BLOCK_PLACEMENT_SQUARE_SIZE,
  SONG_OFFSET,
  BLOCK_SIZE,
} from '../../constants';

import { Obstacle } from '../../types';

interface Props {
  obstacle: Obstacle;
  snapTo: number;
  beatDepth: number;
  handleDelete: (id: string) => void;
  handleResize: (id: string, newBeatDuration: number) => void;
  handleClick: (id: string) => void;
  handleMouseOver: (ev: any) => void;
}

const RESIZE_THRESHOLD = 30;

// This method gets the position in terms of the obstacle's top-left corner!
// This will need to be adjusted.
const getPositionForObstacle = (
  { lane, beatStart }: Obstacle,
  beatDepth: number
): [number, number, number] => {
  // Our `x` parameter is controlled by `lane`. It can be in 1 of 4 places.
  const x = lane * BLOCK_COLUMN_WIDTH - BLOCK_COLUMN_WIDTH * 2;

  // Our `y` parameter is always the same, because our block always starts
  // at the top. The type (wallf | ceiling) dictates whether it reaches down
  // to the floor or not, but given that this method only cares about top-left,
  // that isn't a concern for now.
  // The very top of our object is at
  const y = BLOCK_PLACEMENT_SQUARE_SIZE * 1.75;

  // since, again, we only care about the top-left-front of our shape,
  // this one is easy: it's `beatStart` number of beats down the pike, plus whatever
  // offset we have, similar to SongBlocks
  const z = beatStart * beatDepth * -1 - SONG_OFFSET;

  return [x, y, z];
};

// in Threejs, objects are always positioned relative to their center.
// This is tricky when it comes to obstacles, which come in a range of sizes
// and shapes; it would be much easier to orient them based on their front
// position. This function works that all out.
const adjustPositionForObstacle = (
  humanizedPosition: [number, number, number],
  width: number,
  height: number,
  depth: number
) => {
  // For our `x`, if our obstacle's `width` was only 1, we could shift it by
  // 0.5 BLOCK_COLUMN_WIDTH. If our width is 2, we'd need to shift right by 1.
  // 3, and it would be shifted by 1.5
  const x = humanizedPosition[0] + BLOCK_SIZE * (width / 2);

  const y = humanizedPosition[1] - height / 2;
  const z = humanizedPosition[2] - depth / 2 + 0.1;

  return [x, y, z];
};

const ObstacleBox: React.FC<Props> = ({
  obstacle,
  beatDepth,
  snapTo,
  handleDelete,
  handleResize,
  handleClick,
  handleMouseOver,
}) => {
  const { type, colspan, tentative } = obstacle;

  const width = colspan * BLOCK_COLUMN_WIDTH;
  const height =
    type === 'wall' ? BLOCK_COLUMN_WIDTH * 3.5 : BLOCK_COLUMN_WIDTH * 1.25;
  let depth = obstacle.beatDuration * beatDepth;
  if (depth === 0) {
    depth = 0.01;
  }

  const mesh = React.useMemo(() => {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshPhongMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: tentative ? 0.15 : 0.4,
      polygonOffset: true,
      polygonOffsetFactor: 1, // positive value pushes polygon further away
      polygonOffsetUnits: 1,
      side: THREE.DoubleSide,
      emissive: 'yellow',
      emissiveIntensity: obstacle.selected ? 0.5 : 0,
    });

    return new THREE.Mesh(geometry, material);
  }, [depth, height, tentative, width, obstacle.selected]);

  const humanizedPosition = getPositionForObstacle(obstacle, beatDepth);
  const actualPosition = adjustPositionForObstacle(
    humanizedPosition,
    width,
    height,
    depth
  );

  const [mouseDownAt, setMouseDownAt] = React.useState(false);

  React.useEffect(() => {
    const handlePointerMove = (ev: any) => {
      if (!mouseDownAt) {
        return;
      }

      // @ts-ignore
      const delta = ev.pageX - mouseDownAt;
      if (Math.abs(delta) > RESIZE_THRESHOLD) {
        // Check how many "steps" away this is from the mouse-down position
        let numOfSteps = Math.floor(delta / RESIZE_THRESHOLD);

        // If this number is different from our current value, dispatch a
        // resize event
        let newBeatDuration = obstacle.beatDuration + snapTo * numOfSteps;

        // Ignore negative beat durations
        newBeatDuration = Math.max(0, newBeatDuration);

        if (newBeatDuration !== obstacle.beatDuration) {
          handleResize(obstacle.id, newBeatDuration);
        }
      }
    };

    const handlePointerUp = () => {
      if (mouseDownAt) {
        // @ts-ignore
        setMouseDownAt(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mouseDownAt, handleResize]);

  return (
    // @ts-ignore
    <primitive
      object={mesh}
      position={actualPosition}
      onPointerUp={(ev: any) => {
        if (obstacle.tentative) {
          return;
        }

        // Impossible condition, I believe
        if (typeof mouseDownAt !== 'number') {
          return;
        }

        // if the user is resizing the box, we don't want to also select it.
        // They should be two distinct operations.
        const distance = Math.abs(ev.pageX - mouseDownAt);
        if (distance > RESIZE_THRESHOLD) {
          return;
        }

        ev.stopPropagation();

        handleClick(obstacle.id);
      }}
      onPointerDown={(ev: any) => {
        ev.stopPropagation();

        if (ev.buttons === 2) {
          handleDelete(obstacle.id);
        } else {
          setMouseDownAt(ev.pageX);
        }
      }}
      onPointerOver={handleMouseOver}
    />
  );
};

export default ObstacleBox;
