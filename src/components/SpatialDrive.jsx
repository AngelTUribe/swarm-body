import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SpatialDrive = ({ handsPositionRef }) => {
  const gameGroupRef = useRef();
  const carRef = useRef();
  
  // Physics State
  const speedRef = useRef(0);
  const angleRef = useRef(0);

  const neonCyan = new THREE.Color('#00ffcc');
  const neonPink = new THREE.Color('#ff00ff');

  // Gesture Recognition
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
    
    // Only render when the 3rd project is expanded
    if (!uiState || uiState.expandedId !== 'p3') {
      if (gameGroupRef.current) gameGroupRef.current.visible = false;
      return;
    }

    if (gameGroupRef.current) gameGroupRef.current.visible = true;

    const hands = handsPositionRef.current?.landmarks || [];
    const screenW = window.innerWidth;

    let leftHand = null;
    let rightHand = null;

    // Split hands based on screen side
    hands.forEach(hand => {
      if (!hand || !hand[8]) return;
      const ix = (1 - hand[8].x) * screenW;
      if (ix < screenW / 2) leftHand = hand;
      else rightHand = hand;
    });

    // === ENGINE (Left Hand) ===
    let acceleration = 0;
    if (leftHand) {
      if (isOpenPalm(leftHand)) {
        acceleration = 0.015; // Gas
      } else if (isFist(leftHand)) {
        acceleration = -0.01; // Reverse / Brake
      }
    }

    // === STEERING (Right Hand) ===
    let steerInput = 0;
    if (rightHand) {
      const ix = (1 - rightHand[8].x) * screenW;
      const rightCenter = screenW * 0.75;
      
      // Calculate how far left/right the hand is from the center of its zone
      const rawSteer = (rightCenter - ix) / (screenW * 0.25);
      
      // Clamp between -1 and 1
      steerInput = Math.max(-1, Math.min(1, rawSteer)); 
    }

    // === APPLY PHYSICS ===
    speedRef.current += acceleration;
    speedRef.current *= 0.95; // Friction (coasts to a stop)

    // Only allow steering if the car is actually moving
    if (Math.abs(speedRef.current) > 0.001) {
      // Reverse steering direction if driving backward
      const directionMult = speedRef.current > 0 ? 1 : -1;
      angleRef.current += steerInput * 0.08 * directionMult;
    }

    // Update Car Position
    if (carRef.current) {
      carRef.current.rotation.y = angleRef.current;
      
      const nextX = carRef.current.position.x + Math.sin(angleRef.current) * speedRef.current;
      const nextZ = carRef.current.position.z + Math.cos(angleRef.current) * speedRef.current;

      // Arena Collision Boundaries (Hard stop at the walls)
      if (nextX < 9.5 && nextX > -9.5) carRef.current.position.x = nextX;
      else speedRef.current *= -0.5; // Bounce off wall
      
      if (nextZ < 9.5 && nextZ > -9.5) carRef.current.position.z = nextZ;
      else speedRef.current *= -0.5; // Bounce off wall
    }
  });

  return (
    // Set slightly back so you can see the whole arena
    <group ref={gameGroupRef} position={[0, -2, -8]} visible={false}>
      
      {/* ARENA ENVIRONMENT */}
      <group>
        {/* Tron-style grid floor */}
        <gridHelper args={[20, 20, neonPink, '#110022']} position={[0, 0, 0]} />
        
        {/* Outer Walls */}
        <mesh position={[0, 0.5, -10]}>
            <boxGeometry args={[20, 1, 0.2]} />
            <meshBasicMaterial color={neonCyan} wireframe />
        </mesh>
        <mesh position={[0, 0.5, 10]}>
            <boxGeometry args={[20, 1, 0.2]} />
            <meshBasicMaterial color={neonCyan} wireframe />
        </mesh>
        <mesh position={[-10, 0.5, 0]}>
            <boxGeometry args={[0.2, 1, 20]} />
            <meshBasicMaterial color={neonCyan} wireframe />
        </mesh>
        <mesh position={[10, 0.5, 0]}>
            <boxGeometry args={[0.2, 1, 20]} />
            <meshBasicMaterial color={neonCyan} wireframe />
        </mesh>
      </group>

      {/* THE PLAYER CAR */}
      <group ref={carRef} position={[0, 0.25, 0]}>
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