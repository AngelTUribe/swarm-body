import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

const JointDot = ({ index, nosePositionRef }) => {
  const meshRef = useRef();

  useFrame(() => {
    if (!meshRef.current || !nosePositionRef.current.landmarks) return;
    
    const landmark = nosePositionRef.current.landmarks[index];
    if (!landmark || landmark.visibility < 0.5) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;

    const targetX = ((1 - landmark.x) - 0.5) * 10;
    const targetY = -(landmark.y - 0.5) * 10;
    const targetZ = -landmark.z * 5; 

    meshRef.current.position.x += (targetX - meshRef.current.position.x) * 0.2;
    meshRef.current.position.y += (targetY - meshRef.current.position.y) * 0.2;
    meshRef.current.position.z += (targetZ - meshRef.current.position.z) * 0.2;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshStandardMaterial color="cyan" emissive="cyan" emissiveIntensity={0.5} />
    </mesh>
  );
};

const Scene = ({ nosePositionRef }) => {
  const allJoints = useMemo(() => Array.from({ length: 33 }, (_, i) => i), []);

  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
      <color attach="background" args={['#050505']} />
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      
      {allJoints.map((jointIndex) => (
        <JointDot 
          key={jointIndex} 
          index={jointIndex} 
          nosePositionRef={nosePositionRef} 
        />
      ))}
    </Canvas>
  );
};

export default Scene;