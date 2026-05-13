import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const NeonBuilder = ({ handsPositionRef }) => {
  const { camera, raycaster } = useThree();
  const [blocks, setBlocks] = useState([]);

  const worldGroupRef = useRef();
  const invisiblePlaneRef = useRef();
  const ghostCubeRef = useRef();

  const lastRotPos = useRef(null);
  const lastBuiltPos = useRef(null);

  const neonColor = new THREE.Color('#ff00ff');
  const blockSize = 0.4;

  const isPinching3D = (hand) => {
    const thumb = hand[4];
    const index = hand[8];
    const dx = thumb.x - index.x;
    const dy = thumb.y - index.y;
    const dz = thumb.z - index.z; 
    return Math.sqrt(dx * dx + dy * dy + dz * dz) < 0.055;
  };

  const isFist = (hand) => {
    const wrist = hand[0];
    const tips = [8, 12, 16, 20];
    let curled = 0;
    tips.forEach(t => {
       const tipDist = Math.hypot(hand[t].x - wrist.x, hand[t].y - wrist.y);
       const knuckleDist = Math.hypot(hand[t-3].x - wrist.x, hand[t-3].y - wrist.y);
       if (tipDist < knuckleDist) curled++;
    });
    return curled >= 3 && !isPinching3D(hand);
  };

  const snap = (val, step) => Math.floor(val / step) * step + step / 2;

  useFrame(() => {
    const uiState = handsPositionRef.current?.uiState;
    if (!uiState || uiState.expandedId !== 'p3') {
      if (worldGroupRef.current) worldGroupRef.current.visible = false;
      return;
    }

    if (worldGroupRef.current) worldGroupRef.current.visible = true;

    const hands = handsPositionRef.current?.landmarks || [];
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    let rightHand = null;
    let leftHand = null;

    hands.forEach(hand => {
      if (!hand || !hand[8]) return;
      const ix = (1 - hand[8].x) * screenW;
      if (ix > screenW / 2) rightHand = hand;
      else leftHand = hand;
    });

    let isRotating = false;

    // === 1. RIGHT HAND: WORLD ROTATOR ===
    if (rightHand) {
      const pinching = isPinching3D(rightHand);
      const ix = (1 - rightHand[8].x) * screenW;
      const iy = rightHand[8].y * screenH;

      if (pinching) {
        isRotating = true;
        if (lastRotPos.current && worldGroupRef.current) {
          const dx = ix - lastRotPos.current.x;
          const dy = iy - lastRotPos.current.y;
          // Spin the canvas!
          worldGroupRef.current.rotation.y += dx * 0.005;
          worldGroupRef.current.rotation.x += dy * 0.005;
        }
        lastRotPos.current = { x: ix, y: iy };
      } else {
        lastRotPos.current = null;
      }
    } else {
      lastRotPos.current = null;
    }

    // === 2. LEFT HAND: 2D VOXEL BUILDER ===
    if (leftHand && !isRotating) {
      const ix = (1 - leftHand[8].x) * screenW;
      const iy = leftHand[8].y * screenH;
      const pinching = isPinching3D(leftHand);
      const fist = isFist(leftHand);

      const ndcX = (ix / screenW) * 2 - 1;
      const ndcY = -(iy / screenH) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

      // ONLY raycast the invisible plane! Ignore the blocks entirely to prevent 3D stacking.
      const targets = [];
      if (invisiblePlaneRef.current) targets.push(invisiblePlaneRef.current);

      const intersects = raycaster.intersectObjects(targets, false);

      if (intersects.length > 0) {
        const hitPointWorld = intersects[0].point;
        const localHitPoint = worldGroupRef.current.worldToLocal(hitPointWorld.clone());

        // Force strictly 2D by snapping X and Y, and locking Z to exactly 0
        const targetPos = {
            x: snap(localHitPoint.x, blockSize),
            y: snap(localHitPoint.y, blockSize),
            z: 0 
        };

        if (ghostCubeRef.current) {
          ghostCubeRef.current.position.set(targetPos.x, targetPos.y, targetPos.z);
          ghostCubeRef.current.visible = !fist;
        }

        // BUILD: Continuous Painting Mode
        if (pinching) {
           if (!lastBuiltPos.current ||
               lastBuiltPos.current.x !== targetPos.x ||
               lastBuiltPos.current.y !== targetPos.y) {

               setBlocks(prev => {
                 const exists = prev.some(b => b.x === targetPos.x && b.y === targetPos.y);
                 if (!exists) return [...prev, { ...targetPos, id: Date.now() }];
                 return prev;
               });
               lastBuiltPos.current = { ...targetPos };
           }
        } else {
           lastBuiltPos.current = null;
        }

        // ERASE: Delete whatever block matches the current grid coordinate
        if (fist) {
           setBlocks(prev => prev.filter(b => b.x !== targetPos.x || b.y !== targetPos.y));
           if (ghostCubeRef.current) ghostCubeRef.current.visible = false;
        }

      } else {
        if (ghostCubeRef.current) ghostCubeRef.current.visible = false;
        lastBuiltPos.current = null;
      }
    } else {
      if (ghostCubeRef.current) ghostCubeRef.current.visible = false;
      lastBuiltPos.current = null;
    }
  });

  return (
    // Centered in front of the camera
    <group position={[0, 0, 0]}> 
      <group ref={worldGroupRef}>

        {/* The visual anchor canvas - rotated 90 degrees to face the camera */}
        <gridHelper args={[20, 50, '#00ffcc', '#003322']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]} />

        {/* The Raycast backboard - no longer rotated, stands up straight */}
        <mesh ref={invisiblePlaneRef} position={[0, 0, 0]}>
           <planeGeometry args={[20, 20]} />
           <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <group>
           {blocks.map(block => (
             <mesh key={block.id} position={[block.x, block.y, block.z]}>
               {/* Shrink the block slightly so they don't perfectly touch, leaving a cool grid gap */}
               <boxGeometry args={[blockSize - 0.02, blockSize - 0.02, blockSize - 0.02]} />
               <meshBasicMaterial color={neonColor} transparent opacity={0.3} depthWrite={false} />
               <lineSegments>
                 <edgesGeometry args={[new THREE.BoxGeometry(blockSize - 0.02, blockSize - 0.02, blockSize - 0.02)]} />
                 <lineBasicMaterial color={neonColor} linewidth={2} />
               </lineSegments>
             </mesh>
           ))}
        </group>

        <mesh ref={ghostCubeRef} visible={false}>
          <boxGeometry args={[blockSize, blockSize, blockSize]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} wireframe />
        </mesh>

      </group>
    </group>
  );
};

export default NeonBuilder;