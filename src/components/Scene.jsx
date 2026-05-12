import React from 'react';
import { Canvas } from '@react-three/fiber';
import Swarm from './Swarm'; // <-- Import the new component

const Scene = ({ handsPositionRef }) => {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
      
      {/* We pass the ML data into the Swarm. 
        You can increase 'count' if your computer is fast! 
      */}
      <Swarm handsPositionRef={handsPositionRef} count={4000} />

    </Canvas>
  );
};

export default Scene;