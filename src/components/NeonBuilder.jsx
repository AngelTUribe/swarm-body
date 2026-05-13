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

  const neonColor = new THREE.Color('#ff00ff');
  const blockSize = 1.5;

  useFrame(() => {
    const uiState = handsPositionRef.current?.uiState;
    
    // FIX 1: Accurately checks your specific UI State!
   if (!uiState || uiState.expandedId !== 'p3') {
      if (worldGroupRef.current) worldGroupRef.current.visible = false;
      return;
    }

    if (worldGroupRef.current) worldGroupRef.current.visible = true;

    const hands = handsPositionRef.current?.landmarks || [];
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    const hand = hands[0];
    if (!hand) {
       if (ghostCubeRef.current) ghostCubeRef.current.visible = false;
       lastPalmPosRef.current = null;
       return;
    }

    const thumb = hand[4];
    const index = hand[8];
    const wrist = hand[0];

    const ix = (1 - index.x) * screenW;
    const iy = index.y * screenH;
    const tx = (1 - thumb.x) * screenW;
    const ty = thumb.y * screenH;

    // === 1. GESTURE RECOGNITION ===
    const isPinching = Math.hypot(tx - ix, ty - iy) < 45;

    const tips = [8, 12, 16, 20];
    let curledCount = 0;
    tips.forEach(tipIdx => {
       const tipDist = Math.hypot(hand[tipIdx].x - wrist.x, hand[tipIdx].y - wrist.y);
       const knuckleDist = Math.hypot(hand[tipIdx - 3].x - wrist.x, hand[tipIdx - 3].y - wrist.y);
       if (tipDist < knuckleDist) curledCount++;
    });
    
    const isFist = curledCount >= 3 && !isPinching; 
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
  // THE FIX: Add optional chaining and a fallback vector
  const hitNormal = intersects[0].face?.normal || new THREE.Vector3(0, 1, 0); 
  const hitObject = intersects[0].object;
      
      const targetPos = hitPoint.clone().add(hitNormal.clone().multiplyScalar(blockSize * 0.5));
      
      targetPos.x = Math.floor(targetPos.x / blockSize) * blockSize + (blockSize/2);
      targetPos.y = Math.floor(targetPos.y / blockSize) * blockSize + (blockSize/2);
      targetPos.z = Math.floor(targetPos.z / blockSize) * blockSize + (blockSize/2);

      if (ghostCubeRef.current) {
         ghostCubeRef.current.position.copy(targetPos);
         ghostCubeRef.current.visible = !isOpenPalm && !isFist; 
      }

      if (isPinching && !prevPinchRef.current) {
         setBlocks(prev => {
            const exists = prev.some(b => b.x === targetPos.x && b.y === targetPos.y && b.z === targetPos.z);
            if (!exists) {
               return [...prev, { x: targetPos.x, y: targetPos.y, z: targetPos.z, id: Date.now() }];
            }
            return prev;
         });
      }

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

    // === 3. ROTATE WORLD ===
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
      
      {/* FIX 2: Invisible plane must be transparent, not visible={false}, or raycaster ignores it! */}
      <mesh ref={invisiblePlaneRef} rotation={[-Math.PI/2, 0, 0]} position={[0, -1, 0]}>
         <planeGeometry args={[100, 100]} />
         <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

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

      <mesh ref={ghostCubeRef} visible={false}>
        <boxGeometry args={[blockSize + 0.05, blockSize + 0.05, blockSize + 0.05]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} wireframe />
      </mesh>
    </group>
  );
};

export default NeonBuilder;