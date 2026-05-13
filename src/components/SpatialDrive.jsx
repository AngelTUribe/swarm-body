import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SpatialDrive = ({ handsPositionRef }) => {
  const gameGroupRef = useRef();
  const carRef = useRef();
  
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

    let leftHand = null;
    let rightHand = null;

    hands.forEach(hand => {
      if (!hand || !hand[8]) return;
      const ix = (1 - hand[8].x) * screenW;
      if (ix < screenW / 2) leftHand = hand;
      else rightHand = hand;
    });

    // === SMOOTHER ENGINE ===
    let acceleration = 0;
    if (leftHand) {
      if (isOpenPalm(leftHand)) {
        acceleration = 0.006; // Lowered gas for control
      } else if (isFist(leftHand)) {
        acceleration = -0.004; // Gentle brakes
      }
    }

    // === HEAVIER STEERING ===
    let steerInput = 0;
    if (rightHand) {
      const ix = (1 - rightHand[8].x) * screenW;
      const rightCenter = screenW * 0.75;
      const rawSteer = (rightCenter - ix) / (screenW * 0.25);
      steerInput = Math.max(-1, Math.min(1, rawSteer)); 
    }

    speedRef.current += acceleration;
    speedRef.current *= 0.93; // Higher friction so it doesn't slide forever

    if (Math.abs(speedRef.current) > 0.001) {
      const directionMult = speedRef.current > 0 ? 1 : -1;
      angleRef.current += steerInput * 0.035 * directionMult; // Slower turn radius
    }

    // === OVAL TRACK PHYSICS ===
    if (carRef.current) {
      carRef.current.rotation.y = angleRef.current;
      
      const nextX = carRef.current.position.x + Math.sin(angleRef.current) * speedRef.current;
      const nextZ = carRef.current.position.z + Math.cos(angleRef.current) * speedRef.current;

      const distFromCenter = Math.hypot(nextX, nextZ);
      const innerRadius = 5;
      const outerRadius = 11;

      // Wall bumping logic - scrubs speed instead of violently bouncing
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
    // THE TILT: Rotated up by -Math.PI/3 to face the camera like a top-down arcade game!
    <group ref={gameGroupRef} position={[0, -2, -12]} rotation={[-Math.PI / 3, 0, 0]} visible={false}>
      
      {/* THE TRACK */}
      <group>
        {/* Dark Asphalt Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
           <ringGeometry args={[5, 11, 64]} />
           <meshBasicMaterial color="#050a0f" transparent opacity={0.9} />
        </mesh>
        
        {/* Neon Outer Wall */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[11, 11.2, 64]} />
            <meshBasicMaterial color={neonCyan} side={THREE.DoubleSide} />
        </mesh>

        {/* Neon Inner Wall */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[4.8, 5, 64]} />
            <meshBasicMaterial color={neonPink} side={THREE.DoubleSide} />
        </mesh>

        {/* Center Grid Decoration */}
        <gridHelper args={[9, 10, neonPink, '#110022']} position={[0, -0.1, 0]} />
      </group>

      {/* THE PLAYER CAR (Starts on the track at X=8) */}
      <group ref={carRef} position={[8, 0.25, 0]}>
        {/* Main Body */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.6, 0.3, 1.2]} />
          <meshBasicMaterial color={neonCyan} transparent opacity={0.8} />
        </mesh>
        {/* Glowing Spoiler */}
        <mesh position={[0, 0.3, -0.5]}>
          <boxGeometry args={[0.7, 0.1, 0.2]} />
          <meshBasicMaterial color={neonPink} />
        </mesh>
        {/* Headlights */}
        <mesh position={[0.2, 0, 0.6]}>
          <boxGeometry args={[0.15, 0.15, 0.05]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-0.2, 0, 0.6]}>
          <boxGeometry args={[0.15, 0.15, 0.05]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>

    </group>
  );
};

export default SpatialDrive;