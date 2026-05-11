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

// This function tapers the 3D volume. 
// Thick at the wrist/palm, thin at the fingertips.
const getThickness = (jointIndex) => {
  const tips = [4, 8, 12, 16, 20];
  const upperJoints = [3, 7, 11, 15, 19];
  
  if (tips.includes(jointIndex)) return 0.05; // Thin fingertips
  if (upperJoints.includes(jointIndex)) return 0.15; // Mid fingers
  return 0.35; // Thick palm and wrist
};

const Swarm = ({ handsPositionRef, count = 15000 }) => {
  const pointsRef = useRef();

  // 1. Setup the Particle Matrix
  const { positions, assignments, tValues, offsets, handAssignments } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const assignments = new Int32Array(count); 
    const tValues = new Float32Array(count);   
    const offsets = new Float32Array(count * 3); 
    const handAssignments = new Int32Array(count);

    for (let i = 0; i < count; i++) {
      // 50% chance to belong to Left Hand, 50% for Right Hand
      handAssignments[i] = Math.random() > 0.5 ? 0 : 1;
      
      // Pick a random bone to attach to
      assignments[i] = Math.floor(Math.random() * HAND_CONNECTIONS.length);
      tValues[i] = Math.random(); // Position along the bone (0.0 to 1.0)

      // Spherical math to create a "cloud" around the bone
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      
      // We will multiply this normalized sphere by the thickness later
      offsets[i * 3] = Math.sin(phi) * Math.cos(theta);
      offsets[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
      offsets[i * 3 + 2] = Math.cos(phi);
    }
    return { positions, assignments, tValues, offsets, handAssignments };
  }, [count]);

  // 2. The Animation Loop
  useFrame(() => {
    if (!pointsRef.current || !handsPositionRef.current?.landmarks) return;
    const allHands = handsPositionRef.current.landmarks;
    const positions = pointsRef.current.geometry.attributes.position.array;

    for (let i = 0; i < count; i++) {
      const handIndex = handAssignments[i];
      const i3 = i * 3;

      // If the specific hand this particle belongs to isn't on screen, hide it
      if (!allHands[handIndex]) {
        positions[i3] = 9999; // Move off-screen
        continue;
      }

      const hand = allHands[handIndex];
      const boneIndex = assignments[i];
      const [startIdx, endIdx] = HAND_CONNECTIONS[boneIndex];
      
      const jointA = hand[startIdx];
      const jointB = hand[endIdx];

      if (!jointA || !jointB) continue;

      // Convert ML coordinates to 3D Space
      const ax = ((1 - jointA.x) - 0.5) * 10;
      const ay = -(jointA.y - 0.5) * 10;
      const az = -jointA.z * 5;

      const bx = ((1 - jointB.x) - 0.5) * 10;
      const by = -(jointB.y - 0.5) * 10;
      const bz = -jointB.z * 5;

      // Interpolate position along the bone
      const t = tValues[i];
      const centerX = ax + (bx - ax) * t;
      const centerY = ay + (by - ay) * t;
      const centerZ = az + (bz - az) * t;

      // Calculate thickness tapering based on which end of the bone we are closer to
      const thicknessA = getThickness(startIdx);
      const thicknessB = getThickness(endIdx);
      const currentThickness = thicknessA + (thicknessB - thicknessA) * t;

      // Apply the offset to create volume
      positions[i3] = centerX + (offsets[i3] * currentThickness);
      positions[i3 + 1] = centerY + (offsets[i3 + 1] * currentThickness);
      positions[i3 + 2] = centerZ + (offsets[i3 + 2] * currentThickness);
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
      {/* High-tech glowing material */}
      <pointsMaterial
        size={0.03}
        color="#00ffcc"
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

export default Swarm;