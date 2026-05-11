import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const Swarm = ({ handsPositionRef, count = 2000 }) => {
  const pointsRef = useRef();

  const { positions, assignments, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const assignments = new Int32Array(count);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
      
      // We have up to 42 joints (2 hands * 21 joints)
      assignments[i] = Math.floor(Math.random() * 42); 
      speeds[i] = 0.15 + Math.random() * 0.2; // Fast, snappy speeds
    }
    return { positions, assignments, speeds };
  }, [count]);

  useFrame(() => {
    if (!pointsRef.current || !handsPositionRef.current?.landmarks) return;

    const allHands = handsPositionRef.current.landmarks;
    if (allHands.length === 0) return; // If no hands are on screen, do nothing

    // Combine all detected hands into one flat list of active joints
    const activeLandmarks = [];
    allHands.forEach(hand => {
      hand.forEach(joint => activeLandmarks.push(joint));
    });

    const positions = pointsRef.current.geometry.attributes.position.array;

    for (let i = 0; i < count; i++) {
      // Safely assign particles only to joints that are currently visible
      const targetIndex = assignments[i] % activeLandmarks.length;
      const targetLandmark = activeLandmarks[targetIndex];

      if (!targetLandmark) continue;

      const targetX = ((1 - targetLandmark.x) - 0.5) * 10;
      const targetY = -(targetLandmark.y - 0.5) * 10;
      const targetZ = -targetLandmark.z * 5;

      const i3 = i * 3;
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
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

export default Swarm;