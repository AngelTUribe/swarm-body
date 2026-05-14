import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Text } from '@react-three/drei';
import * as THREE from 'three';

const SpatialDrive = ({ handsPositionRef }) => {
  const gameGroupRef = useRef();
  const carRef = useRef();
  const steeringWheelRef = useRef();
  
  const activeHandMemory = useRef({ position: null, locked: false, lostFrames: 0 });
  const speedRef = useRef(0);
  const angleRef = useRef(0);
  
  // Lap Tracking
  const [laps, setLaps] = useState(0);
  const checkpointRef = useRef(false);

  const neonCyan = new THREE.Color('#00ffcc');
  const neonPink = new THREE.Color('#ff00ff');

  // Track Dimensions
  const straightLength = 20; 
  const innerRadius = 8;
  const outerRadius = 16;

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
    if (!isActive) return;

    const hands = handsPositionRef.current?.landmarks || [];
    const screenW = window.innerWidth;

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
      // Find the right-most hand on the screen (which is the user's physical right hand due to mirroring)
      activeHand = hands.reduce((rightmost, current) => {
        const currentScreenX = (1 - current[0].x) * screenW;
        const rightmostScreenX = (1 - rightmost[0].x) * screenW;
        return currentScreenX > rightmostScreenX ? current : rightmost;
      });
      activeHandMemory.current.locked = true;
      activeHandMemory.current.lostFrames = 0;
    }

    let steerInput = 0;

    if (!activeHand) {
      activeHandMemory.current.lostFrames++;
      if (activeHandMemory.current.lostFrames > 15) {
        activeHandMemory.current.locked = false;
        activeHandMemory.current.position = null;
      }
    } else {
      activeHandMemory.current.position = activeHand[8];
      
      let acceleration = 0;
      if (isOpenPalm(activeHand)) acceleration = 0.008; 
      else if (isFist(activeHand)) acceleration = -0.005; 

      const ix = (1 - activeHand[8].x) * screenW;
      const center = screenW / 2;
      const rawSteer = (center - ix) / (screenW * 0.3);
      steerInput = Math.max(-1, Math.min(1, rawSteer)); 

      speedRef.current += acceleration;
      if (Math.abs(speedRef.current) > 0.001) {
        const directionMult = speedRef.current > 0 ? 1 : -1;
        angleRef.current += steerInput * 0.04 * directionMult; 
      }
    }

    speedRef.current *= 0.94; // Friction

    if (carRef.current) {
      carRef.current.rotation.y = angleRef.current;
      
      // Animate Steering Wheel
      if (steeringWheelRef.current) {
        steeringWheelRef.current.rotation.z = -steerInput * Math.PI * 0.5;
      }
      
      const nextX = carRef.current.position.x + Math.sin(angleRef.current) * speedRef.current;
      const nextZ = carRef.current.position.z + Math.cos(angleRef.current) * speedRef.current;

      // OVAL TRACK COLLISION MATH
      const clampedZ = Math.max(-straightLength, Math.min(straightLength, nextZ));
      const distFromCenterLine = Math.hypot(nextX - 0, nextZ - clampedZ);

      if (distFromCenterLine < innerRadius) {
        const bounceAngle = Math.atan2(nextX, nextZ - clampedZ);
        carRef.current.position.x = Math.sin(bounceAngle) * innerRadius;
        carRef.current.position.z = clampedZ + Math.cos(bounceAngle) * innerRadius;
        speedRef.current *= 0.4; 
      } else if (distFromCenterLine > outerRadius) {
        const bounceAngle = Math.atan2(nextX, nextZ - clampedZ);
        carRef.current.position.x = Math.sin(bounceAngle) * outerRadius;
        carRef.current.position.z = clampedZ + Math.cos(bounceAngle) * outerRadius;
        speedRef.current *= 0.4; 
      } else {
        carRef.current.position.x = nextX;
        carRef.current.position.z = nextZ;
      }

      // LAP LOGIC
      const currentX = carRef.current.position.x;
      const currentZ = carRef.current.position.z;
      
      // Hit the left side of the track to validate the next finish line crossing
      if (currentX < 0 && currentZ > -5 && currentZ < 5) {
        checkpointRef.current = true;
      }
      
      // Cross finish line on the right side
      if (checkpointRef.current && currentX > 0 && currentZ > -1 && currentZ < 1 && Math.cos(angleRef.current) > 0) {
        setLaps(prev => prev + 1);
        checkpointRef.current = false;
      }
    }
  });

  return (
    <group ref={gameGroupRef} visible={false}>
      
      {/* THE WORLD / TRACK */}
      <group>
        {/* Ground Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
           <planeGeometry args={[100, 100]} />
           <meshBasicMaterial color="#050a0f" />
        </mesh>

        {/* Finish Line */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12, 0.01, 0]}>
          <planeGeometry args={[8, 2]} />
          <meshBasicMaterial color="#ffffff" wireframe />
        </mesh>

        {/* Outer Wall Boundaries */}
        <mesh position={[0, 1, 0]}>
           <capsuleGeometry args={[outerRadius + 0.5, straightLength * 2, 4, 32]} />
           <meshBasicMaterial color={neonCyan} wireframe transparent opacity={0.3} side={THREE.BackSide} />
        </mesh>

        {/* Inner Wall Boundaries */}
        <mesh position={[0, 1, 0]}>
           <capsuleGeometry args={[innerRadius - 0.5, straightLength * 2, 4, 32]} />
           <meshBasicMaterial color={neonPink} wireframe transparent opacity={0.3} />
        </mesh>

        {/* Neon Track Lines */}
        <gridHelper args={[100, 100, neonPink, '#110022']} position={[0, -0.04, 0]} />
      </group>

      {/* THE CAR (1st Person Setup) */}
      <group ref={carRef} position={[12, 0.5, -5]}>
        
        {/* 1st Person Camera */}
        <PerspectiveCamera 
            makeDefault={handsPositionRef.current?.uiState?.expandedId === 'p3'} 
            position={[0, 0.8, -0.5]} 
            rotation={[0, 0, 0]} 
            fov={80} 
        />

        {/* Dashboard / Windshield UI */}
        <group position={[0, 0.6, 0.8]}>
            <mesh position={[0, -0.4, 0]} rotation={[-0.2, 0, 0]}>
                <boxGeometry args={[2, 0.5, 0.2]} />
                <meshBasicMaterial color="#0a1520" />
            </mesh>
            <mesh position={[0, -0.4, 0]} rotation={[-0.2, 0, 0]}>
                <boxGeometry args={[2.05, 0.55, 0.2]} />
                <meshBasicMaterial color={neonCyan} wireframe />
            </mesh>
            
            {/* Steering Wheel */}
            <group ref={steeringWheelRef} position={[0, -0.1, -0.1]} rotation={[-0.4, 0, 0]}>
                <mesh>
                    <torusGeometry args={[0.3, 0.04, 16, 32]} />
                    <meshBasicMaterial color={neonPink} />
                </mesh>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.02, 0.02, 0.6]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
            </group>

            {/* HUD: Lap Counter */}
            <Text
                position={[0.5, 0, 0]}
                fontSize={0.2}
                color={neonCyan}
                anchorX="center"
                anchorY="middle"
                font="FiraMono-Regular.ttf"
            >
                {`LAPS: ${laps}`}
            </Text>
        </group>
        
        {/* Car Body (Mostly invisible from inside, but good for shadows/debug) */}
        <mesh position={[0, 0, 0]}><boxGeometry args={[1.5, 0.5, 3]} /><meshBasicMaterial color="#111" /></mesh>
      </group>
    </group>
  );
};

export default SpatialDrive;