import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const NeonBuilder = ({ handsPositionRef }) => {
  const { camera, raycaster } = useThree();
  const [blocks, setBlocks] = useState([]);
  
  const worldGroupRef = useRef();
  const blocksGroupRef = useRef();
  const invisiblePlaneRef = useRef();
  const ghostCubeRef = useRef();

  const prevPinchRef = useRef(false);
  const lastPalmPosRef = useRef(null);

  // The Hot Pink Neon from your reference image!
  const neonColor = new THREE.Color('#ff00ff');
  const blockSize = 1.5;

  useFrame(() => {
    const uiState = handsPositionRef.current?.uiState;
    
    // Completely hide the engine if we aren't in the Game mode
    if (!uiState || uiState.activeId !== 'p3') {
      if (worldGroupRef.current) worldGroupRef.current.visible = false;
      return;
    }

    if (worldGroupRef.current) worldGroupRef.current.visible = true;

    const hands = handsPositionRef.current?.landmarks || [];
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Use Hand 1 for building
    const hand = hands[0];
    if (!hand) {
       if (ghostCubeRef.current) ghostCubeRef.current.visible = false;
       lastPalmPosRef.current = null;
       return;
    }

    const thumb = hand[4];
    const index = hand[8];
    const wrist = hand[0];

    // Screen Coords
    const ix = (1 - index.x) * screenW;
    const iy = index.y * screenH;
    const tx = (1 - thumb.x) * screenW;
    const ty = thumb.y * screenH;

    // === 1. GESTURE RECOGNITION ===
    
    // A. Pinch
    const isPinching = Math.hypot(tx - ix, ty - iy) < 45;

    // B. Fist (Check if all 4 fingertips are curled closer to the wrist than their knuckles are)
    const tips = [8, 12, 16, 20];
    let curledCount = 0;
    tips.forEach(tipIdx => {
       const tipDist = Math.hypot(hand[tipIdx].x - wrist.x, hand[tipIdx].y - wrist.y);
       const knuckleDist = Math.hypot(hand[tipIdx - 3].x - wrist.x, hand[tipIdx - 3].y - wrist.y);
       if (tipDist < knuckleDist) curledCount++;
    });
    const isFist = curledCount >= 3 && !isPinching; 

    // C. Open Palm (Fingers extended, not pinching)
    const isOpenPalm = !isPinching && !isFist && curledCount === 0;

    // === 2. 3D RAYCASTING ===
    const ndcX = (ix / screenW) * 2 - 1;
    const ndcY = -(iy / screenH) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

    const targets = [];
    if (invisiblePlaneRef.current) targets.push(invisiblePlaneRef.current);
    if (blocksGroupRef.current) targets.push(...blocksGroupRef.current.children);

    const intersects = raycaster.intersectObjects(targets, false);

    if (intersects.length > 0) {
      const hitPoint = intersects[0].point;
      const hitNormal = intersects[0].face.normal;
      const hitObject = intersects[0].object;
      
      // Calculate target by pushing slightly OUT of the face we hit
      const targetPos = hitPoint.clone().add(hitNormal.clone().multiplyScalar(blockSize * 0.5));
      
      // Math: Snap exactly to a clean 3D grid
      targetPos.x = Math.floor(targetPos.x / blockSize) * blockSize + (blockSize/2);
      targetPos.y = Math.floor(targetPos.y / blockSize) * blockSize + (blockSize/2);
      targetPos.z = Math.floor(targetPos.z / blockSize) * blockSize + (blockSize/2);

      // Show aiming cursor
      if (ghostCubeRef.current) {
         ghostCubeRef.current.position.copy(targetPos);
         ghostCubeRef.current.visible = !isOpenPalm && !isFist; 
      }

      // ACTION: BUILD BLOCK
      if (isPinching && !prevPinchRef.current) {
         setBlocks(prev => {
            const exists = prev.some(b => b.x === targetPos.x && b.y === targetPos.y && b.z === targetPos.z);
            if (!exists) {
               return [...prev, { x: targetPos.x, y: targetPos.y, z: targetPos.z, id: Date.now() }];
            }
            return prev;
         });
      }

      // ACTION: ERASER FIST
      if (isFist) {
         if (hitObject && hitObject !== invisiblePlaneRef.current) {
            const blockId = hitObject.userData.blockId;
            if (blockId) {
               setBlocks(prev => prev.filter(b => b.id !== blockId));
            }
         }
         if (ghostCubeRef.current) ghostCubeRef.current.visible = false;
      }
    } else {
      if (ghostCubeRef.current) ghostCubeRef.current.visible = false;
    }

    // === 3. ROTATE WORLD (Open Palm) ===
    if (isOpenPalm) {
       if (lastPalmPosRef.current !== null) {
          const deltaX = index.x - lastPalmPosRef.current.x;
          const deltaY = index.y - lastPalmPosRef.current.y;
          
          if (worldGroupRef.current) {
             worldGroupRef.current.rotation.y += deltaX * 3;
             worldGroupRef.current.rotation.x += deltaY * 3;
          }
       }
       lastPalmPosRef.current = { x: index.x, y: index.y };
    } else {
       lastPalmPosRef.current = null;
    }

    prevPinchRef.current = isPinching;
  });

  return (
    <group ref={worldGroupRef} visible={false}>
      {/* Invisible baseline plane (gives you something to place the first block on) */}
      <mesh ref={invisiblePlaneRef} visible={false}>
         <planeGeometry args={[100, 100]} />
      </mesh>

      {/* RENDER THE NEON BLOCKS */}
      <group ref={blocksGroupRef}>
         {blocks.map(block => (
           <mesh key={block.id} position={[block.x, block.y, block.z]} userData={{ blockId: block.id }}>
             <boxGeometry args={[blockSize, blockSize, blockSize]} />
             <meshBasicMaterial color={neonColor} transparent opacity={0.15} depthWrite={false} />
             <lineSegments>
               <edgesGeometry args={[new THREE.BoxGeometry(blockSize, blockSize, blockSize)]} />
               <lineBasicMaterial color={neonColor} linewidth={2} />
             </lineSegments>
           </mesh>
         ))}
      </group>

      {/* Holographic Aiming Cursor */}
      <mesh ref={ghostCubeRef} visible={false}>
        <boxGeometry args={[blockSize + 0.05, blockSize + 0.05, blockSize + 0.05]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} wireframe />
      </mesh>
    </group>
  );
};

export default NeonBuilder;