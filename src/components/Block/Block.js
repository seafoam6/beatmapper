import React from 'react';

import blockDirectionalUrl from '../../assets/obj/block-directional.obj';
import blockCenterUrl from '../../assets/obj/block-center.obj';
import useObject from '../../hooks/use-object.hook';

const getBlockUrlForDirection = direction => {
  switch (direction) {
    case 0:
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
      return blockDirectionalUrl;

    case 8:
      return blockCenterUrl;

    default:
      throw new Error('Unrecognized direction: ' + direction);
  }
};

const getRotationForDirection = direction => {
  // The numbering system used is completely nonsensical:
  //
  //   4  0  5
  //   2  8  3
  //   6  1  7
  //
  // Our block by default points downwards, so we'll do x-axis rotations
  // depending on the number
  switch (direction) {
    case 0: // up
      return Math.PI;
    case 1: // down
      return 0;
    case 2: // left
      return Math.PI * -0.5;
    case 3: // right
      return Math.PI * 0.5;
    case 4: // up-left
      return Math.PI * -0.75;
    case 5: // up-right
      return Math.PI * 0.75;
    case 6: //  down-left
      return Math.PI * -0.25;
    case 7:
      return Math.PI * 0.25;

    case 8: // Center. Doesn't need to be rotated.
      return 0;

    default:
      throw new Error('Unrecognized direction: ' + direction);
  }
};

const Block = React.memo(
  ({
    x,
    y,
    z,
    time,
    lineLayer,
    lineIndex,
    direction,
    size = 1,
    color = 0xff0000,
    isTransparent,
    isSelected,
    handleClick,
    handleStartSelecting,
    handleMouseOver,
  }) => {
    const position = [x, y, z];

    const scaleFactor = size * 0.5;

    const url = getBlockUrlForDirection(direction);
    const group = useObject(url);

    if (!group) {
      return null;
    }

    const geometry = group.children[0].geometry;

    const rotation = [0, 0, getRotationForDirection(direction)];

    const onClick = ev => {
      ev.stopPropagation();
    };

    const onPointerDown = ev => {
      ev.stopPropagation();

      // We can rapidly select/deselect/delete notes by clicking, holding,
      // and dragging the cursor across the field.
      // prettier-ignore
      let selectionMode;
      if (ev.button === 0) {
        selectionMode = isSelected ? 'deselect' : 'select';
      } else if (ev.button === 1) {
        // Middle clicks shouldnt affect selections
        selectionMode = null;
      } else if (ev.button === 2) {
        selectionMode = 'delete';
      }

      if (selectionMode) {
        handleStartSelecting(selectionMode);
      }

      // prettier-ignore
      const clickType = ev.button === 0
        ? 'left'
        : ev.button === 1
          ? 'middle'
          : ev.button === 2
            ? 'right'
            : undefined;

      if (clickType) {
        handleClick(clickType, time, lineLayer, lineIndex);
      }
    };

    const onPointerOver = ev => {
      ev.stopPropagation();

      handleMouseOver(time, lineLayer, lineIndex);
    };

    return (
      <group>
        <mesh
          castShadow
          position={position}
          scale={[scaleFactor, scaleFactor, scaleFactor]}
          rotation={rotation}
          onClick={onClick}
          onPointerDown={onPointerDown}
          onPointerOver={onPointerOver}
        >
          <primitive object={geometry} attach="geometry" />
          <meshStandardMaterial
            attach="material"
            metalness={0.5}
            roughness={0.4}
            color={color}
            transparent={isTransparent}
            emissive={'yellow'}
            emissiveIntensity={isSelected ? 0.5 : 0}
            opacity={isTransparent ? 0.25 : 1}
          />
        </mesh>

        {/* Fake flowing light from within */}
        <mesh
          position={[position[0], position[1], position[2] + size * 0.2]}
          rotation={rotation}
          onClick={onClick}
          onPointerDown={onPointerDown}
          onPointerOver={onPointerOver}
        >
          <planeGeometry attach="geometry" args={[size * 0.8, size * 0.8]} />
          <meshLambertMaterial
            attach="material"
            emissive={0xffffff}
            transparent={isTransparent}
            opacity={isTransparent ? 0.25 : 1}
          />
        </mesh>
      </group>
    );
  }
);

export default Block;
