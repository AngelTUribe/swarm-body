import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 1. The Exact Anatomical Blueprint of the Hand
const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index Finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle Finger
  [9, 10], [10, 11], [11, 12],
  // Ring Finger
  [13, 14], [14, 15], [15, 16],
  // Pinky Finger
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm Webbing (Connecting the base knuckles together)
  [5, 9], [9, 13], [13, 17]
];

const Swarm = ({ handsPositionRef }) => {
  const linesRef = useRef();
  const jointsRef = useRef();

  // 2. Setup the arrays to hold our 3D data
  const { maxHands, totalJoints, totalBones } = useMemo(() => {
    const maxHands = 2; // Track up to 2 hands
    const jointsPerHand = 21;
    const bonesPerHand = HAND_CONNECTIONS.length;
    
    return {
      maxHands,
      totalJoints: maxHands * jointsPerHand,
      totalBones: maxHands * bonesPerHand,
    };
  }, []);

  const { jointPositions, bonePositions } = useMemo(() => {
    // Array for the glowing joint dots
    const jointPositions = new Float32Array(totalJoints * 3);
    // Array for the laser lines connecting them (each bone needs a Start and End point)
    const bonePositions = new Float32Array(totalBones * 6); 
    return { jointPositions, bonePositions };
  }, [totalJoints, totalBones]);

  // 3. The Real-Time Tracking Loop
  useFrame(() => {
    if (!handsPositionRef.current?.landmarks) return;
    
    const allHands = handsPositionRef.current.landmarks;
    
    // Hide everything if no hands are detected
    if (allHands.length === 0) {
      if (jointsRef.current) jointsRef.current.visible = false;
      if (linesRef.current) linesRef.current.visible = false;
      return;
    }

    if (jointsRef.current) jointsRef.current.visible = true;
    if (linesRef.current) linesRef.current.visible = true;

    let jointIndex = 0;
    let boneArrayOffset = 0;

    // Loop through every hand the camera sees
    allHands.forEach((hand) => {
      // Create an array to temporarily hold the 3D coordinates of this specific hand
      const currentHand3D = [];

      // A. Update the Joints (Knuckles & Fingertips)
      hand.forEach((landmark) => {
        const targetX = ((1 - landmark.x) - 0.5) * 10;
        const targetY = -(landmark.y - 0.5) * 10;
        const targetZ = -landmark.z * 5;

        // Save for the lines to use
        currentHand3D.push({ x: targetX, y: targetY, z: targetZ });

        // Update the glowing dots
        jointPositions[jointIndex * 3] = targetX;
        jointPositions[jointIndex * 3 + 1] = targetY;
        jointPositions[jointIndex * 3 + 2] = targetZ;
        jointIndex++;
      });

      // B. Update the Bones (The glowing lines)
      HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const startJoint = currentHand3D[startIdx];
        const endJoint = currentHand3D[endIdx];

        if (startJoint && endJoint) {
          // Point A (Start of bone)
          bonePositions[boneArrayOffset] = startJoint.x;
          bonePositions[boneArrayOffset + 1] = startJoint.y;
          bonePositions[boneArrayOffset + 2] = startJoint.z;
          
          // Point B (End of bone)
          bonePositions[boneArrayOffset + 3] = endJoint.x;
          bonePositions[boneArrayOffset + 4] = endJoint.y;
          bonePositions[boneArrayOffset + 5] = endJoint.z;
          
          boneArrayOffset += 6;
        }
      });
    });

    // Tell the graphics card to paint the new positions!
    if (jointsRef.current) jointsRef.current.geometry.attributes.position.needsUpdate = true;
    if (linesRef.current) linesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group>
      {/* The Laser Lines (Bones) */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={bonePositions.length / 3}
            array={bonePositions}
            itemSize={3}
          />
        </bufferGeometry>
        {/* Additive blending creates the "Hologram/Neon" effect */}
        <lineBasicMaterial 
          color="#00ffff" 
          transparent 
          opacity={0.8} 
          blending={THREE.AdditiveBlending} 
        />
      </lineSegments>

      {/* The Glowing Joints (Knuckles) */}
      <points ref={jointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={jointPositions.length / 3}
            array={jointPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial 
          size={0.15} 
          color="#ffffff" 
          transparent 
          opacity={0.9} 
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
};

export default Swarm;