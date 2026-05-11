import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 1. Define the "Bones" connecting the MediaPipe joints
const POSE_CONNECTIONS = [
  // Torso
  [11, 12], [11, 23], [12, 24], [23, 24], 
  // Left Arm & Hand
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  // Right Arm & Hand
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  // Left Leg
  [23, 25], [25, 27], [27, 29], [29, 31],
  // Right Leg
  [24, 26], [26, 28], [28, 30], [30, 32],
  // Head (Creating a simple volume connecting nose to ears/shoulders)
  [0, 7], [0, 8], [7, 11], [8, 12]
];

const Swarm = ({ nosePositionRef, count = 5000 }) => {
  const pointsRef = useRef();

  const { positions, assignments, speeds, tValues, offsets } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const assignments = new Int32Array(count); // Which bone this particle belongs to
    const tValues = new Float32Array(count);   // Where along the bone it sits (0.0 to 1.0)
    const offsets = new Float32Array(count * 3); // The "thickness" of the body
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;

      // Assign to a random bone
      assignments[i] = Math.floor(Math.random() * POSE_CONNECTIONS.length);
      
      // Random spot along the bone
      tValues[i] = Math.random(); 

      // Give the body some volume (random noise around the bone)
      // Change the 0.4 to make the silhouette thicker or thinner
      const thickness = 0.01; 
      offsets[i * 3] = (Math.random() - 0.5) * thickness;
      offsets[i * 3 + 1] = (Math.random() - 0.5) * thickness;
      offsets[i * 3 + 2] = (Math.random() - 0.5) * thickness;

      speeds[i] = 0.08 + Math.random() * 0.1;
    }
    return { positions, assignments, speeds, tValues, offsets };
  }, [count]);

  useFrame(() => {
    if (!pointsRef.current || !nosePositionRef.current?.landmarks) return;

    const landmarks = nosePositionRef.current.landmarks;
    const positions = pointsRef.current.geometry.attributes.position.array;

    for (let i = 0; i < count; i++) {
      const boneIndex = assignments[i];
      const [jointA_idx, jointB_idx] = POSE_CONNECTIONS[boneIndex];
      
      const jointA = landmarks[jointA_idx];
      const jointB = landmarks[jointB_idx];

      // If either end of the bone is invisible, let the particle float
      if (!jointA || !jointB || jointA.visibility < 0.5 || jointB.visibility < 0.5) continue;

      // Calculate 3D coordinates for Joint A
      const ax = ((1 - jointA.x) - 0.5) * 10;
      const ay = -(jointA.y - 0.5) * 10;
      const az = -jointA.z * 5;

      // Calculate 3D coordinates for Joint B
      const bx = ((1 - jointB.x) - 0.5) * 10;
      const by = -(jointB.y - 0.5) * 10;
      const bz = -jointB.z * 5;

      // Interpolate: Find the exact spot along the bone using the tValue
      const t = tValues[i];
      const targetX = ax + (bx - ax) * t + offsets[i * 3];
      const targetY = ay + (by - ay) * t + offsets[i * 3 + 1];
      const targetZ = az + (bz - az) * t + offsets[i * 3 + 2];

      const i3 = i * 3;

      // Smoothly move the particle toward its calculated spot on the bone
      positions[i3] += (targetX - positions[i3]) * speeds[i];
      positions[i3 + 1] += (targetY - positions[i3 + 1]) * speeds[i];
      positions[i3 + 2] += (targetZ - positions[i3 + 2]) * speeds[i];
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
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
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

export default Swarm;