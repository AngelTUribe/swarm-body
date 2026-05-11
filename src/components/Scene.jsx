import React from 'react';
import { Canvas } from '@react-three/fiber';
import Swarm from './Swarm'; // <-- Import the new component

const Scene = ({ nosePositionRef }) => {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
      <color attach="background" args={['#050505']} />
      
      {/* We pass the ML data into the Swarm. 
        You can increase 'count' if your computer is fast! 
      */}
      <Swarm nosePositionRef={nosePositionRef} count={4000} />

    </Canvas>
  );
};

export default Scene;