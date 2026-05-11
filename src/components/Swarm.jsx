import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const Swarm = ({ nosePositionRef, count = 3000 }) => {
  const pointsRef = useRef();

  // 1. Setup Phase: We do this ONCE when the app loads
  const { positions, assignments, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3); // (X, Y, Z) for every particle
    const assignments = new Int32Array(count);     // Which joint each particle follows
    const speeds = new Float32Array(count);        // How fast each particle is

    for (let i = 0; i < count; i++) {
      // Scatter particles randomly on the screen to start
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;

      // Assign each particle to randomly chase one of the 33 body joints
      assignments[i] = Math.floor(Math.random() * 33);

      // Give each particle a slightly different speed for an "organic" feel
      speeds[i] = 0.05 + Math.random() * 0.15;
    }
    return { positions, assignments, speeds };
  }, [count]);

  // 2. The Math Loop: This runs 60 times a second
  useFrame(() => {
    if (!pointsRef.current || !nosePositionRef.current?.landmarks) return;

    const landmarks = nosePositionRef.current.landmarks;
    const positions = pointsRef.current.geometry.attributes.position.array;

    for (let i = 0; i < count; i++) {
      const jointIndex = assignments[i];
      const targetLandmark = landmarks[jointIndex];

      // If the camera loses a joint (like your foot), skip moving this particle
      if (!targetLandmark || targetLandmark.visibility < 0.5) continue;

      // Translate ML Data to 3D Space (same as before)
      const targetX = ((1 - targetLandmark.x) - 0.5) * 10;
      const targetY = -(targetLandmark.y - 0.5) * 10;
      const targetZ = -targetLandmark.z * 5;

      const i3 = i * 3;

      // The Swarm Physics: Move particle a fraction of the distance toward its target
      positions[i3] += (targetX - positions[i3]) * speeds[i];
      positions[i3 + 1] += (targetY - positions[i3 + 1]) * speeds[i];
      positions[i3 + 2] += (targetZ - positions[i3 + 2]) * speeds[i];
    }

    // Crucial: Tell the graphics card we changed the math so it updates the screen!
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
      {/* Additive blending makes particles glow brightly when they cluster together */}
      <pointsMaterial
        size={0.05}
        color="cyan"
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

export default Swarm;