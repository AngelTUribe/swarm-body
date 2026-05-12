import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const ParticleWake = ({ handsPositionRef, count = 2000 }) => {
  const pointsRef = useRef();
  const { viewport } = useThree();

  // Track which particle in the array we are overriding next
  const activeIndex = useRef(0);

  // 1. Pre-build the Particle Data Arrays
  const { positions, ages, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const ages = new Float32Array(count);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 100; // Start safely hidden behind the camera
      ages[i] = 999; // Start them as "dead"
      
      // Give every particle a permanent, random drift direction for when it spawns
      velocities[i * 3] = (Math.random() - 0.5) * 0.03;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.03;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.03;
    }
    return { positions, ages, velocities };
  }, [count]);

  // 2. The Physics Loop
  useFrame(() => {
    if (!pointsRef.current || !handsPositionRef.current?.landmarks) return;
    const allHands = handsPositionRef.current.landmarks;
    const positionsArr = pointsRef.current.geometry.attributes.position.array;

    // A. Age and drift the existing particles
    for (let i = 0; i < count; i++) {
      ages[i] += 1;
      const i3 = i * 3;
      
      if (ages[i] < 50) { 
        // If it's alive (less than 50 frames old), let it drift
        positionsArr[i3] += velocities[i3];
        positionsArr[i3 + 1] += velocities[i3 + 1];
        positionsArr[i3 + 2] += velocities[i3 + 2];
      } else if (ages[i] === 50) {
        // The exact moment it dies, teleport it off-screen
        positionsArr[i3] = 0;
        positionsArr[i3 + 1] = 0;
        positionsArr[i3 + 2] = 100;
      }
    }

    // B. Spawn new particles right at the index finger
    allHands.forEach(hand => {
      const indexFinger = hand[8]; // Point 8 is the index tip
      if (!indexFinger) return;

      // Map ML data to viewport exact same way the Swarm and UI do
      const x = ((1 - indexFinger.x) - 0.5) * viewport.width;
      const y = -(indexFinger.y - 0.5) * viewport.height;
      const z = -(indexFinger.z || 0) * 5;

      // Spawn 5 particles per frame to create a dense, fiery ribbon
      for (let s = 0; s < 5; s++) {
        let idx = activeIndex.current;
        const i3 = idx * 3;
        
        // Add a tiny bit of random scatter so they don't form a perfect straight line
        positionsArr[i3] = x + (Math.random() - 0.5) * 0.3;
        positionsArr[i3 + 1] = y + (Math.random() - 0.5) * 0.3;
        positionsArr[i3 + 2] = z + (Math.random() - 0.5) * 0.3;
        
        ages[idx] = 0; // Reset age to 0 (Birth!)
        
        // Cycle through our 2000 particle buffer continuously
        activeIndex.current = (activeIndex.current + 1) % count;
      }
    });

    // Tell the GPU we moved things
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      {/* Hot pink additive glow for high contrast! */}
      <pointsMaterial
        size={0.08}
        color="#ff0055"
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

export default ParticleWake;