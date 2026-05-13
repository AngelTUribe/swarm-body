import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const NeonBuilder = ({ handsPositionRef }) => {
  const { camera, raycaster } = useThree();
  const [blocks, setBlocks] = useState([]);
  
  const worldGroupRef = useRef();
  const blocksGroupRef = useRef();
  const invisiblePlaneRef = useRef();
  
  // 1. Two ghost cubes for two hands!
  const ghostCube1Ref = useRef();
  const ghostCube2Ref = useRef();
  const ghostCubes = [ghostCube1Ref, ghostCube2Ref];

  const prevPinchRef = useRef([false, false]);
  const lastPalmPosRef = useRef(null);

  const neonColor = new THREE.Color('#ff00ff');
  const blockSize = 0.4; // 2. Scaled down to a reasonable voxel size

  // 3. True 3D depth-aware pinch detection
  const isPinching3D = (thumb, index) => {
    const dx = thumb.x - index.x;
    const dy = thumb.y - index.y;
    const dz = thumb.z - index.z; // MediaPipe provides depth!
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    return dist < 0.055; // The sweet spot for normalized 3D distance
  };

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

    // Toggle ghost cube visibility based on active hands
    ghostCubes.forEach((cube, i) => {
      if (cube.current) cube.current.visible = !!hands[i];
    });

    if (hands.length === 0) {
       lastPalmPosRef.current = null;
       return;
    }

    let isRotating = false;

    // 4. Iterate over BOTH hands
    hands.forEach((hand, i) => {
      if (i > 1) return; // Limit to 2 hands max
      
      const thumb = hand[4];
      const index = hand[8];
      const wrist = hand[0];

      const ix = (1 - index.x) * screenW;
      const iy = index.y * screenH;

      // === ROBUST GESTURE RECOGNITION ===
      const isPinching = isPinching3D(thumb, index);

      const tips = [8, 12, 16, 20];
      let curledCount = 0;
      tips.forEach(tipIdx => {
         const tipDist = Math.hypot(hand[tipIdx].x - wrist.x, hand[tipIdx].y - wrist.y);
         const knuckleDist = Math.hypot(hand[tipIdx - 3].x - wrist.x, hand[tipIdx - 3].y - wrist.y);
         if (tipDist < knuckleDist) curledCount++;
      });
      
      const isFist = curledCount >= 3 && !isPinching; 
      const isOpenPalm = !isPinching && !isFist && curledCount === 0;

      // === 3D RAYCASTING ===
      const ndcX = (ix / screenW) * 2 - 1;
      const ndcY = -(iy / screenH) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

      const targets = [];
      if (invisiblePlaneRef.current) targets.push(invisiblePlaneRef.current);
      if (blocksGroupRef.current) targets.push(...blocksGroupRef.current.children);

      const intersects = raycaster.intersectObjects(targets, false);
      const ghostCube = ghostCubes[i].current;

      if (intersects.length > 0) {
        const hitPoint = intersects[0].point;
        // Fallback normal to prevent crashes on edge cases
        const hitNormal = intersects[0].face?.normal || new THREE.Vector3(0, 1, 0); 
        const hitObject = intersects[0].object;
        
        const targetPos = hitPoint.clone().add(hitNormal.clone().multiplyScalar(blockSize * 0.5));
        
        // Grid snapping
        targetPos.x = Math.floor(targetPos.x / blockSize) * blockSize + (blockSize/2);
        targetPos.y = Math.floor(targetPos.y / blockSize) * blockSize + (blockSize/2);
        targetPos.z = Math.floor(targetPos.z / blockSize) * blockSize + (blockSize/2);

        if (ghostCube) {
           // 5. Smooth Glide (Lerp) instead of rigid teleporting
           ghostCube.position.lerp(targetPos, 0.4);
           ghostCube.visible = !isOpenPalm && !isFist; 
        }

        // BUILD
        if (isPinching && !prevPinchRef.current[i]) {
           setBlocks(prev => {
              const exists = prev.some(b => b.x === targetPos.x && b.y === targetPos.y && b.z === targetPos.z);
              if (!exists) {
                 // Add 'i' to Date.now() so simultaneous pinches don't cause React key collisions
                 return [...prev, { x: targetPos.x, y: targetPos.y, z: targetPos.z, id: Date.now() + i }];
              }
              return prev;
           });
        }

        // ERASE
        if (isFist) {
           if (hitObject && hitObject !== invisiblePlaneRef.current) {
              const blockId = hitObject.userData.blockId;
              if (blockId) {
                 setBlocks(prev => prev.filter(b => b.id !== blockId));
              }
           }
           if (ghostCube) ghostCube.visible = false;
        }
      } else {
        if (ghostCube) ghostCube.visible = false;
      }

      // === ROTATE WORLD ===
      // Only allow one hand to rotate the world at a time to prevent glitching
      if (isOpenPalm && !isRotating) {
         isRotating = true;
         if (lastPalmPosRef.current !== null) {
            const deltaX = index.x - lastPalmPosRef.current.x;
            const deltaY = index.y - lastPalmPosRef.current.y;
            
            if (worldGroupRef.current) {
               worldGroupRef.current.rotation.y += deltaX * 4;
               worldGroupRef.current.rotation.x += deltaY * 4;
            }
         }
         lastPalmPosRef.current = { x: index.x, y: index.y };
      }

      prevPinchRef.current[i] = isPinching;
    });

    // Reset rotation anchor if no hands are acting as an open palm
    if (!isRotating) {
       lastPalmPosRef.current = null;
    }
  });

  return (
    <group ref={worldGroupRef} visible={false}>
      
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

      {/* Unique ghost cubes for left and right hands */}
      <mesh ref={ghostCube1Ref} visible={false}>
        <boxGeometry args={[blockSize + 0.02, blockSize + 0.02, blockSize + 0.02]} />
        <meshBasicMaterial color="#00ffcc" transparent opacity={0.8} wireframe />
      </mesh>
      <mesh ref={ghostCube2Ref} visible={false}>
        <boxGeometry args={[blockSize + 0.02, blockSize + 0.02, blockSize + 0.02]} />
        <meshBasicMaterial color="#ff00ff" transparent opacity={0.8} wireframe />
      </mesh>
    </group>
  );
};

export default NeonBuilder;