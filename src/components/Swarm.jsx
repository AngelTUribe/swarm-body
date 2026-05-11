import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [9, 10], [10, 11], [11, 12],    // Middle
  [13, 14], [14, 15], [15, 16],   // Ring
  [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [5, 9], [9, 13], [13, 17], // Knuckles
  [0, 9], [0, 13] // Palm inner structure
];

const getThickness = (jointIndex) => {
  const tips = [4, 8, 12, 16, 20];
  const upperJoints = [3, 7, 11, 15, 19];
  if (tips.includes(jointIndex)) return 0.04; 
  if (upperJoints.includes(jointIndex)) return 0.06; 
  return 0.25; 
};

const Swarm = ({ handsPositionRef, count = 15000 }) => {
  const pointsRef = useRef();

  const { positions, assignments, tValues, offsets, handAssignments } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const assignments = new Int32Array(count); 
    const tValues = new Float32Array(count);   
    const offsets = new Float32Array(count * 3); 
    const handAssignments = new Int32Array(count);

    for (let i = 0; i < count; i++) {
      handAssignments[i] = Math.random() > 0.5 ? 0 : 1;
      assignments[i] = Math.floor(Math.random() * HAND_CONNECTIONS.length);
      tValues[i] = Math.random(); 

      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      
      offsets[i * 3] = Math.sin(phi) * Math.cos(theta);
      offsets[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
      offsets[i * 3 + 2] = Math.cos(phi);
    }
    return { positions, assignments, tValues, offsets, handAssignments };
  }, [count]);

  useFrame(() => {
    if (!pointsRef.current || !handsPositionRef.current?.landmarks) return;
    const allHands = handsPositionRef.current.landmarks;
    const positions = pointsRef.current.geometry.attributes.position.array;

    for (let i = 0; i < count; i++) {
      const handIndex = handAssignments[i];
      const i3 = i * 3;

      // FIX 1: Safely hide unused particles behind the camera instead of 9999
      if (!allHands[handIndex]) {
        positions[i3] = 0;
        positions[i3 + 1] = 0;
        positions[i3 + 2] = 10; 
        continue;
      }

      const hand = allHands[handIndex];
      const boneIndex = assignments[i];
      const [startIdx, endIdx] = HAND_CONNECTIONS[boneIndex];
      
      const jointA = hand[startIdx];
      const jointB = hand[endIdx];

      if (!jointA || !jointB) continue;

      const ax = ((1 - jointA.x) - 0.5) * 10;
      const ay = -(jointA.y - 0.5) * 10;
      const az = -(jointA.z || 0) * 5; // FIX 2: Added safety fallback for Z

      const bx = ((1 - jointB.x) - 0.5) * 10;
      const by = -(jointB.y - 0.5) * 10;
      const bz = -(jointB.z || 0) * 5; // FIX 2: Added safety fallback for Z

      const t = tValues[i];
      const centerX = ax + (bx - ax) * t;
      const centerY = ay + (by - ay) * t;
      const centerZ = az + (bz - az) * t;

      const thicknessA = getThickness(startIdx);
      const thicknessB = getThickness(endIdx);
      const currentThickness = thicknessA + (thicknessB - thicknessA) * t;

      positions[i3] = centerX + (offsets[i3] * currentThickness);
      positions[i3 + 1] = centerY + (offsets[i3 + 1] * currentThickness);
      positions[i3 + 2] = centerZ + (offsets[i3 + 2] * currentThickness);
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}      
        color="#00ffff"  
        transparent
        opacity={0.8}    
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

export default Swarm;