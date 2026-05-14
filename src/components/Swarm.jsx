import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], 
  [0, 5], [5, 6], [6, 7], [7, 8], 
  [9, 10], [10, 11], [11, 12],    
  [13, 14], [14, 15], [15, 16],   
  [0, 17], [17, 18], [18, 19], [19, 20], 
  [5, 9], [9, 13], [13, 17], 
  [0, 9], [0, 13] 
];

const getThickness = (jointIndex) => {
  const tips = [4, 8, 12, 16, 20];
  const upperJoints = [3, 7, 11, 15, 19];
  const midJoints = [2, 6, 10, 14, 18];
  const baseJoints = [1, 5, 9, 13, 17]; 

  if (tips.includes(jointIndex)) return 0.03;        
  if (upperJoints.includes(jointIndex)) return 0.06; 
  if (midJoints.includes(jointIndex)) return 0.08;   
  if (baseJoints.includes(jointIndex)) return 0.12;  
  return 0.25; 
};

const Swarm = ({ handsPositionRef, count = 4000 }) => {
  const pointsRef = useRef();
  const { viewport } = useThree();

  const { positions, assignments, tValues, offsets, handAssignments, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const assignments = new Int32Array(count); 
    const tValues = new Float32Array(count);   
    const offsets = new Float32Array(count * 3); 
    const handAssignments = new Int32Array(count);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      handAssignments[i] = Math.random() > 0.5 ? 0 : 1;
      assignments[i] = Math.floor(Math.random() * HAND_CONNECTIONS.length);
      tValues[i] = Math.random(); 
      speeds[i] = 0.15 + Math.random() * 0.1; 

      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      
      offsets[i * 3] = Math.sin(phi) * Math.cos(theta);
      offsets[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
      offsets[i * 3 + 2] = Math.cos(phi);
    }
    return { positions, assignments, tValues, offsets, handAssignments, speeds };
  }, [count]);

  useFrame(() => {
    if (!pointsRef.current || !handsPositionRef.current?.landmarks) return;
    const allHands = handsPositionRef.current.landmarks;
    const positions = pointsRef.current.geometry.attributes.position.array;

    for (let i = 0; i < count; i++) {
      const handIndex = handAssignments[i];
      const i3 = i * 3;
      const speed = speeds[i];

      if (!allHands[handIndex]) {
        continue;
      }

      const hand = allHands[handIndex];
      const boneIndex = assignments[i];
      const [startIdx, endIdx] = HAND_CONNECTIONS[boneIndex];
      
      const jointA = hand[startIdx];
      const jointB = hand[endIdx];

      if (!jointA || !jointB) continue;

      const ax = ((1 - jointA.x) - 0.5) * viewport.width;
      const ay = -(jointA.y - 0.5) * viewport.height;
      const az = -(jointA.z || 0) * 5; 

      const bx = ((1 - jointB.x) - 0.5) * viewport.width;
      const by = -(jointB.y - 0.5) * viewport.height;
      const bz = -(jointB.z || 0) * 5;

      const t = tValues[i];
      const centerX = ax + (bx - ax) * t;
      const centerY = ay + (by - ay) * t;
      const centerZ = az + (bz - az) * t;

      const thicknessA = getThickness(startIdx);
      const thicknessB = getThickness(endIdx);
      const currentThickness = thicknessA + (thicknessB - thicknessA) * t;

      const targetX = centerX + (offsets[i3] * currentThickness);
      const targetY = centerY + (offsets[i3 + 1] * currentThickness);
      const targetZ = centerZ + (offsets[i3 + 2] * currentThickness);

      positions[i3] += (targetX - positions[i3]) * speed;
      positions[i3 + 1] += (targetY - positions[i3 + 1]) * speed;
      positions[i3 + 2] += (targetZ - positions[i3 + 2]) * speed;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.07} color="#00ffff" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
};

export default Swarm;