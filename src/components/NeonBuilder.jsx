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

  const lastRotPos = useRef(null);
  const lastBuiltPos = useRef(null);

  const neonColor = new THREE.Color('#ff00ff');
  const blockSize = 0.4;

  // True 3D depth-aware pinch detection
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

    // Split roles based on screen position
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
          // Spin the world
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

    // === 2. LEFT HAND: VOXEL BUILDER ===
    if (leftHand && !isRotating) {
      const ix = (1 - leftHand[8].x) * screenW;
      const iy = leftHand[8].y * screenH;
      const pinching = isPinching3D(leftHand);
      const fist = isFist(leftHand);

      const ndcX = (ix / screenW) * 2 - 1;
      const ndcY = -(iy / screenH) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

      const targets = [];
      if (invisiblePlaneRef.current) targets.push(invisiblePlaneRef.current);
      if (blocksGroupRef.current) targets.push(...blocksGroupRef.current.children);

      const intersects = raycaster.intersectObjects(targets, false);

      if (intersects.length > 0) {
        const hitPointWorld = intersects[0].point;
        const hitObject = intersects[0].object;

        // THE FIX: Convert world hit into the rotated group's local space
        const localHitPoint = worldGroupRef.current.worldToLocal(hitPointWorld.clone());
        const localNormal = intersects[0].face?.normal?.clone() || new THREE.Vector3(0, 1, 0);

        const targetPos = localHitPoint.add(localNormal.multiplyScalar(blockSize * 0.5));
        
        targetPos.x = snap(targetPos.x, blockSize);
        targetPos.y = snap(targetPos.y, blockSize);
        targetPos.z = snap(targetPos.z, blockSize);

        if (ghostCubeRef.current) {
          ghostCubeRef.current.position.lerp(targetPos, 0.6); // Smooth glide
          ghostCubeRef.current.visible = !fist;
        }

        // BUILD: Continuous Painting Mode
        if (pinching) {
           if (!lastBuiltPos.current ||
               lastBuiltPos.current.x !== targetPos.x ||
               lastBuiltPos.current.y !== targetPos.y ||
               lastBuiltPos.current.z !== targetPos.z) {

               setBlocks(prev => {
                 const exists = prev.some(b => b.x === targetPos.x && b.y === targetPos.y && b.z === targetPos.z);
                 if (!exists) return [...prev, { ...targetPos, id: Date.now() }];
                 return prev;
               });
               lastBuiltPos.current = { ...targetPos };
           }
        } else {
           lastBuiltPos.current = null;
        }

        // ERASE: Make a fist over a block to delete it
        if (fist) {
           if (hitObject !== invisiblePlaneRef.current) {
              const blockId = hitObject.userData.blockId;
              if (blockId) {
                 setBlocks(prev => prev.filter(b => b.id !== blockId));
              }
           }
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
    // Moved down slightly so it sits comfortably in your camera view
    <group position={[0, -1, 0]}> 
      <group ref={worldGroupRef}>

        {/* The visual anchor floor */}
        <gridHelper args={[20, 50, '#00ffcc', '#003322']} position={[0, 0, 0]} />

        <mesh ref={invisiblePlaneRef} rotation={[-Math.PI/2, 0, 0]} position={[0, 0, 0]}>
           <planeGeometry args={[20, 20]} />
           <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <group ref={blocksGroupRef}>
           {blocks.map(block => (
             <mesh key={block.id} position={[block.x, block.y, block.z]} userData={{ blockId: block.id }}>
               <boxGeometry args={[blockSize, blockSize, blockSize]} />
               <meshBasicMaterial color={neonColor} transparent opacity={0.3} depthWrite={false} />
               <lineSegments>
                 <edgesGeometry args={[new THREE.BoxGeometry(blockSize, blockSize, blockSize)]} />
                 <lineBasicMaterial color={neonColor} linewidth={2} />
               </lineSegments>
             </mesh>
           ))}
        </group>

        <mesh ref={ghostCubeRef} visible={false}>
          <boxGeometry args={[blockSize + 0.02, blockSize + 0.02, blockSize + 0.02]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} wireframe />
        </mesh>

      </group>
    </group>
  );
};

export default NeonBuilder;