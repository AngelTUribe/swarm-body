import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SpatialDrive = ({ handsPositionRef }) => {
  const gameGroupRef = useRef();
  const carRef = useRef();
  
  const activeHandMemory = useRef({ position: null, locked: false, lostFrames: 0 });
  const speedRef = useRef(0);
  const angleRef = useRef(0);

  const neonCyan = new THREE.Color('#00ffcc');
  const neonPink = new THREE.Color('#ff00ff');

  const isFist = (hand) => {
    const wrist = hand[0];
    const tips = [8, 12, 16, 20];
    let curled = 0;
    tips.forEach(t => {
       const tipDist = Math.hypot(hand[t].x - wrist.x, hand[t].y - wrist.y);
       const knuckleDist = Math.hypot(hand[t-3].x - wrist.x, hand[t-3].y - wrist.y);
       if (tipDist < knuckleDist) curled++;
    });
    return curled >= 3;
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
    return curled === 0;
  };

  useFrame(() => {
    const uiState = handsPositionRef.current?.uiState;
    if (!uiState || uiState.expandedId !== 'p3') {
      if (gameGroupRef.current) gameGroupRef.current.visible = false;
      return;
    }

    if (gameGroupRef.current) gameGroupRef.current.visible = true;

    const hands = handsPositionRef.current?.landmarks || [];
    const screenW = window.innerWidth;

    // === STRICT SPATIAL LOCK ===
    let activeHand = null;

    if (activeHandMemory.current.locked && activeHandMemory.current.position) {
      const lastPos = activeHandMemory.current.position;
      let bestHand = null;
      let minDist = Infinity;

      hands.forEach(h => {
        if (!h[8]) return;
        const dist = Math.hypot(h[8].x - lastPos.x, h[8].y - lastPos.y);
        if (dist < minDist) { minDist = dist; bestHand = h; }
      });

      if (bestHand && minDist < 0.2) {
        activeHand = bestHand;
        activeHandMemory.current.lostFrames = 0;
      } else {
        activeHand = null;
      }
    } else if (hands.length > 0) {
      activeHand = hands[0];
      activeHandMemory.current.locked = true;
      activeHandMemory.current.lostFrames = 0;
    }

    // Buffer logic
    if (!activeHand) {
      activeHandMemory.current.lostFrames++;
      if (activeHandMemory.current.lostFrames > 15) {
        activeHandMemory.current.locked = false;
        activeHandMemory.current.position = null;
      }
      // If we are buffering, we skip applying steering input for this frame (it coasts)
    } else {
      activeHandMemory.current.position = activeHand[8];
      
      let acceleration = 0;
      let steerInput = 0;

      if (isOpenPalm(activeHand)) {
        acceleration = 0.006; 
      } else if (isFist(activeHand)) {
        acceleration = -0.004; 
      }

      const ix = (1 - activeHand[8].x) * screenW;
      const center = screenW / 2;
      const rawSteer = (center - ix) / (screenW * 0.4);
      steerInput = Math.max(-1, Math.min(1, rawSteer)); 

      speedRef.current += acceleration;
      if (Math.abs(speedRef.current) > 0.001) {
        const directionMult = speedRef.current > 0 ? 1 : -1;
        angleRef.current += steerInput * 0.035 * directionMult; 
      }
    }

    // Always apply friction and movement, even if buffering
    speedRef.current *= 0.93; 

    if (carRef.current) {
      carRef.current.rotation.y = angleRef.current;
      
      const nextX = carRef.current.position.x + Math.sin(angleRef.current) * speedRef.current;
      const nextZ = carRef.current.position.z + Math.cos(angleRef.current) * speedRef.current;

      const distFromCenter = Math.hypot(nextX, nextZ);
      const innerRadius = 5;
      const outerRadius = 11;

      if (distFromCenter < innerRadius) {
        const bounceAngle = Math.atan2(nextX, nextZ);
        carRef.current.position.x = Math.sin(bounceAngle) * innerRadius;
        carRef.current.position.z = Math.cos(bounceAngle) * innerRadius;
        speedRef.current *= 0.5; 
      } else if (distFromCenter > outerRadius) {
        const bounceAngle = Math.atan2(nextX, nextZ);
        carRef.current.position.x = Math.sin(bounceAngle) * outerRadius;
        carRef.current.position.z = Math.cos(bounceAngle) * outerRadius;
        speedRef.current *= 0.5; 
      } else {
        carRef.current.position.x = nextX;
        carRef.current.position.z = nextZ;
      }
    }
  });

  return (
    <group ref={gameGroupRef} position={[0, -2, -12]} rotation={[-Math.PI / 3, 0, 0]} visible={false}>
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
           <ringGeometry args={[5, 11, 64]} />
           <meshBasicMaterial color="#050a0f" transparent opacity={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[11, 11.2, 64]} />
            <meshBasicMaterial color={neonCyan} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[4.8, 5, 64]} />
            <meshBasicMaterial color={neonPink} side={THREE.DoubleSide} />
        </mesh>
        <gridHelper args={[9, 10, neonPink, '#110022']} position={[0, -0.1, 0]} />
      </group>

      <group ref={carRef} position={[8, 0.25, 0]}>
        <mesh position={[0, 0, 0]}><boxGeometry args={[0.6, 0.3, 1.2]} /><meshBasicMaterial color={neonCyan} transparent opacity={0.8} /></mesh>
        <mesh position={[0, 0.3, -0.5]}><boxGeometry args={[0.7, 0.1, 0.2]} /><meshBasicMaterial color={neonPink} /></mesh>
        <mesh position={[0.2, 0, 0.6]}><boxGeometry args={[0.15, 0.15, 0.05]} /><meshBasicMaterial color="#ffffff" /></mesh>
        <mesh position={[-0.2, 0, 0.6]}><boxGeometry args={[0.15, 0.15, 0.05]} /><meshBasicMaterial color="#ffffff" /></mesh>
      </group>
    </group>
  );
};

export default SpatialDrive;