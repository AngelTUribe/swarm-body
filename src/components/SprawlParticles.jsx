import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const SprawlParticles = ({ handsPositionRef, count = 2000 }) => {
  const pointsRef = useRef();
  const { viewport } = useThree();
  const activeIndex = useRef(0);

  const { positions, velocities, ages } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const ages = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 100; // Hide off camera
      ages[i] = 999;
    }
    return { positions, velocities, ages };
  }, [count]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const zipperState = handsPositionRef.current?.zipperState;
    if (!zipperState) return;

    const positionsArr = pointsRef.current.geometry.attributes.position.array;

    // 1. Update existing particles
    for (let i = 0; i < count; i++) {
      if (ages[i] < 999) {
        const i3 = i * 3;
        
        if (zipperState.phase === 'transition') {
          // THE SPRAWL: When zipper finishes, blast particles towards the camera!
          velocities[i3] *= 1.05; // Explode outwards radially
          velocities[i3 + 1] *= 1.05;
          velocities[i3 + 2] += 0.2; // Blast into the +Z axis (towards user)
        }

        // Apply velocities
        positionsArr[i3] += velocities[i3];
        positionsArr[i3 + 1] += velocities[i3 + 1];
        positionsArr[i3 + 2] += velocities[i3 + 2];
        
        ages[i] += 1;

        // Kill particles if they live too long or fly past the camera (Z > 5)
        if (ages[i] > 150 || positionsArr[i3 + 2] > 5) {
          positionsArr[i3] = 0;
          positionsArr[i3 + 1] = 0;
          positionsArr[i3 + 2] = 100;
          ages[i] = 999;
        }
      }
    }

    // 2. Spawn new particles if dragging
    if (zipperState.phase === 'boot' && zipperState.progress > 0) {
      // Convert UI pixel X to Three.js viewport X
      const screenW = window.innerWidth;
      const normalizedX = (zipperState.x / screenW) * 2 - 1; // -1 to 1
      const viewportX = normalizedX * (viewport.width / 2);

      // THE FIX: Shift the particles down to match the 75% height of the UI zipper.
      // Since 0 is the center of the 3D viewport, 75% down the screen is -25% of the viewport height.
      const viewportYOffset = -viewport.height * 0.25;

      // Emit 10 dots per frame (Dense light leak!)
      for (let s = 0; s < 10; s++) {
        let idx = activeIndex.current;
        const i3 = idx * 3;
        
        // Spawn scattered vertically along the tear, centered at the zipper X
        positionsArr[i3] = viewportX + (Math.random() - 0.5) * 0.5;
        // Apply the offset here!
        positionsArr[i3 + 1] = viewportYOffset + (Math.random() - 0.5) * (zipperState.progress * viewport.height * 0.6); 
        positionsArr[i3 + 2] = 0; // Flat on the screen
        
        // Give them a slow, random outward drift
        velocities[i3] = (Math.random() - 0.5) * 0.05;
        velocities[i3 + 1] = (Math.random() - 0.5) * 0.05;
        velocities[i3 + 2] = (Math.random() * 0.02); 

        ages[idx] = 0; 
        activeIndex.current = (activeIndex.current + 1) % count;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#00ffff" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
};

export default SprawlParticles;