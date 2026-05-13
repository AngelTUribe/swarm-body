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

  const isOpenPalm = (hand) => {
    const wrist = hand[0];
    const tips = [8, 12, 16, 20];
    let curled = 0;
    tips.forEach(t => {
       const tipDist = Math.hypot(hand[t].x - wrist.x, hand[t].y - wrist.y);
       const knuckleDist = Math.hypot(hand[t-3].x - wrist.x, hand[t-3].y - wrist.y);
       if (tipDist < knuckleDist) curled++;
    });
    return curled === 0 && !isPinching3D(hand);
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

    // STRICTLY lock to the primary hand. 
    const activeHand = hands[0];

    if (!activeHand) {
      if (ghostCubeRef.current) ghostCubeRef.current.visible = false;
      lastRotPos.current = null;
      lastBuiltPos.current = null;
      return;
    }

    const ix = (1 - activeHand[8].x) * screenW;
    const iy = activeHand[8].y * screenH;
    
    const pinching = isPinching3D(activeHand);
    const fist = isFist(activeHand);
    const palm = isOpenPalm(activeHand);

    // === ACTION: ROTATE THE WORLD ===
    if (palm) {
      if (lastRotPos.current && worldGroupRef.current) {
        const dx = ix - lastRotPos.current.x;
        const dy = iy - lastRotPos.current.y;
        
        // REDUCED SENSITIVITY: Lowered from 0.005 to 0.0015 for heavy, smooth spinning
        worldGroupRef.current.rotation.y += dx * 0.0015;
        worldGroupRef.current.rotation.x += dy * 0.0015;
      }
      lastRotPos.current = { x: ix, y: iy };
      if (ghostCubeRef.current) ghostCubeRef.current.visible = false; 
      lastBuiltPos.current = null;
      return; 
    } else {
      lastRotPos.current = null;
    }

    // === ACTION: RAYCAST FOR DRAWING / ERASING ===
    const ndcX = (ix / screenW) * 2 - 1;
    const ndcY = -(iy / screenH) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

    const targets = [];
    if (invisiblePlaneRef.current) targets.push(invisiblePlaneRef.current);

    const intersects = raycaster.intersectObjects(targets, false);

    if (intersects.length > 0) {
      const hitPointWorld = intersects[0].point;
      const localHitPoint = worldGroupRef.current.worldToLocal(hitPointWorld.clone());

      const targetPos = {
          x: snap(localHitPoint.x, blockSize),
          y: snap(localHitPoint.y, blockSize),
          z: 0 
      };

      if (ghostCubeRef.current) {
        ghostCubeRef.current.position.set(targetPos.x, targetPos.y, targetPos.z);
        ghostCubeRef.current.visible = !fist; 
      }

      // === ACTION: CONTINUOUS DRAWING ===
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

      // === ACTION: ERASING ===
      if (fist) {
         setBlocks(prev => prev.filter(b => b.x !== targetPos.x || b.y !== targetPos.y));
         if (ghostCubeRef.current) ghostCubeRef.current.visible = false;
      }

    } else {
      if (ghostCubeRef.current) ghostCubeRef.current.visible = false;
      lastBuiltPos.current = null;
    }
  });

  return (
    // PUSHED BACK: Z is now -3 so it sits at a comfortable distance, and Y is slightly lowered to center it.
    <group position={[0, -0.5, -3]}> 
      <group ref={worldGroupRef}>

        {/* DOUBLE SIDED: Added side={THREE.DoubleSide} so you can draw from the back! */}
        <mesh ref={invisiblePlaneRef} position={[0, 0, 0]}>
           <planeGeometry args={[20, 20]} />
           <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>

        <group>
           {blocks.map(block => (
             <mesh key={block.id} position={[block.x, block.y, block.z]}>
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