import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const SpatialDrive = ({ handsPositionRef }) => {
  const { viewport } = useThree();
  const gameGroupRef = useRef();
  const wheelGroupRef = useRef();
  const carRef = useRef();
  const steeringWheelRef = useRef();
  
  const activeHandMemory = useRef({ position: null, locked: false, lostFrames: 0 });
  const speedRef = useRef(0);
  const angleRef = useRef(0);
  const steerInputRef = useRef(0); // Track steering for the UI wheel

  // Track Dimensions
  const innerRadius = 6;
  const outerRadius = 12;

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
    const isActive = uiState && uiState.expandedId === 'p3';

    if (gameGroupRef.current) gameGroupRef.current.visible = isActive;
    if (wheelGroupRef.current) wheelGroupRef.current.visible = isActive;
    if (!isActive) return;

    const hands = handsPositionRef.current?.landmarks || [];
    const screenW = window.innerWidth;

    // === STRICT RIGHT-HAND LOCK ===
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
      // Find the hand furthest to the right on the screen (physical right hand due to mirror)
      activeHand = hands.reduce((rightmost, current) => {
        const currentScreenX = (1 - current[0].x) * screenW;
        const rightmostScreenX = (1 - rightmost[0].x) * screenW;
        return currentScreenX > rightmostScreenX ? current : rightmost;
      });
      activeHandMemory.current.locked = true;
      activeHandMemory.current.lostFrames = 0;
    }

    let steerInput = 0;

    // Buffer logic
    if (!activeHand) {
      activeHandMemory.current.lostFrames++;
      if (activeHandMemory.current.lostFrames > 15) {
        activeHandMemory.current.locked = false;
        activeHandMemory.current.position = null;
      }
    } else {
      activeHandMemory.current.position = activeHand[8];
      
      let acceleration = 0;

      if (isOpenPalm(activeHand)) {
        acceleration = 0.007; 
      } else if (isFist(activeHand)) {
        acceleration = -0.005; 
      }

      const ix = (1 - activeHand[8].x) * screenW;
      const center = screenW / 2;
      // Calculate steering based on distance from center
      const rawSteer = (center - ix) / (screenW * 0.35);
      steerInput = Math.max(-1, Math.min(1, rawSteer)); 
      steerInputRef.current = steerInput; // Save for the UI wheel

      speedRef.current += acceleration;
      if (Math.abs(speedRef.current) > 0.001) {
        const directionMult = speedRef.current > 0 ? 1 : -1;
        angleRef.current += steerInput * 0.04 * directionMult; 
      }
    }

    // Always apply friction
    speedRef.current *= 0.92; 

    // Animate UI Steering Wheel
    if (steeringWheelRef.current) {
        // Rotate smoothly toward the current steering input
        const targetRotation = -steerInputRef.current * Math.PI * 0.6;
        steeringWheelRef.current.rotation.z += (targetRotation - steeringWheelRef.current.rotation.z) * 0.15;
    }

    // Move Car
    if (carRef.current) {
      carRef.current.rotation.y = angleRef.current;
      
      const nextX = carRef.current.position.x + Math.sin(angleRef.current) * speedRef.current;
      const nextZ = carRef.current.position.z + Math.cos(angleRef.current) * speedRef.current;

      const distFromCenter = Math.hypot(nextX, nextZ);

      // Track Collisions
      if (distFromCenter < innerRadius + 0.5) {
        const bounceAngle = Math.atan2(nextX, nextZ);
        carRef.current.position.x = Math.sin(bounceAngle) * (innerRadius + 0.5);
        carRef.current.position.z = Math.cos(bounceAngle) * (innerRadius + 0.5);
        speedRef.current *= 0.6; 
      } else if (distFromCenter > outerRadius - 0.5) {
        const bounceAngle = Math.atan2(nextX, nextZ);
        carRef.current.position.x = Math.sin(bounceAngle) * (outerRadius - 0.5);
        carRef.current.position.z = Math.cos(bounceAngle) * (outerRadius - 0.5);
        speedRef.current *= 0.6; 
      } else {
        carRef.current.position.x = nextX;
        carRef.current.position.z = nextZ;
      }
    }
  });

  return (
    <>
      {/* THE WORLD / TRACK */}
      <group ref={gameGroupRef} position={[0, -2, -12]} rotation={[-Math.PI / 3.5, 0, 0]} visible={false}>
        
        {/* Grass Background */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
            <circleGeometry args={[25, 64]} />
            <meshBasicMaterial color="#7ec850" />
        </mesh>

        {/* Asphalt Track */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
            <ringGeometry args={[innerRadius, outerRadius, 64]} />
            <meshBasicMaterial color="#333333" />
        </mesh>

        {/* Dashed Center Line */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, 0]}>
            <ringGeometry args={[8.9, 9.1, 64, 1, 0, Math.PI * 2]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.5} wireframe />
        </mesh>

        {/* Inner/Outer Curbs (Borders) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[outerRadius, outerRadius + 0.4, 64]} />
            <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[innerRadius - 0.4, innerRadius, 64]} />
            <meshBasicMaterial color="#ff0000" />
        </mesh>

        {/* Start/Finish Line */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[9, -0.08, 0]}>
            <planeGeometry args={[6, 1]} />
            <meshBasicMaterial color="#ffffff" wireframe />
        </mesh>

        {/* CUTE CAR MODEL */}
        <group ref={carRef} position={[9, 0.3, 0]}>
            {/* Main Body */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.8, 0.4, 1.4]} />
                <meshStandardMaterial color="#ff6b6b" />
            </mesh>
            
            {/* Cabin / Windshield */}
            <mesh position={[0, 0.3, -0.1]}>
                <boxGeometry args={[0.6, 0.3, 0.7]} />
                <meshStandardMaterial color="#4ecdc4" transparent opacity={0.8} />
            </mesh>

            {/* Headlights */}
            <mesh position={[0.25, 0, 0.71]}>
                <circleGeometry args={[0.1, 16]} />
                <meshBasicMaterial color="#ffe66d" />
            </mesh>
            <mesh position={[-0.25, 0, 0.71]}>
                <circleGeometry args={[0.1, 16]} />
                <meshBasicMaterial color="#ffe66d" />
            </mesh>

            {/* Wheels */}
            {/* Front Left */}
            <mesh position={[0.45, -0.1, 0.4]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
                <meshBasicMaterial color="#111111" />
            </mesh>
            {/* Front Right */}
            <mesh position={[-0.45, -0.1, 0.4]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
                <meshBasicMaterial color="#111111" />
            </mesh>
            {/* Back Left */}
            <mesh position={[0.45, -0.1, -0.4]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
                <meshBasicMaterial color="#111111" />
            </mesh>
            {/* Back Right */}
            <mesh position={[-0.45, -0.1, -0.4]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
                <meshBasicMaterial color="#111111" />
            </mesh>
        </group>
      </group>

      {/* 2D HUD OVERLAY (Steering Wheel) */}
      <group ref={wheelGroupRef} visible={false}>
        <group position={[-viewport.width / 2 + 1.5, -viewport.height / 2 + 1.5, 2]}>
          <group ref={steeringWheelRef}>
            {/* Wheel Outer Ring */}
            <mesh>
              <torusGeometry args={[0.8, 0.1, 16, 48]} />
              <meshBasicMaterial color="#333333" />
            </mesh>
            {/* Wheel Center Spoke */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[1.6, 0.15, 0.05]} />
              <meshBasicMaterial color="#555555" />
            </mesh>
            {/* Center Horn */}
            <mesh position={[0, 0, 0.05]}>
              <cylinderGeometry args={[0.2, 0.2, 0.1, 32]} rotation={[Math.PI / 2, 0, 0]} />
              <meshBasicMaterial color="#ff6b6b" />
            </mesh>
          </group>
        </group>
      </group>
      
      {/* Required for the cute car materials to show up properly */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} />
    </>
  );
};

export default SpatialDrive;