import React from 'react';
import { Canvas } from '@react-three/fiber';
import Swarm from './Swarm'; 
import SprawlParticles from './SprawlParticles'; // <-- 1. Import it

const Scene = ({ handsPositionRef }) => {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
      <Swarm handsPositionRef={handsPositionRef} />
      
      {/* 2. Add the Sprawl Generator */}
      <SprawlParticles handsPositionRef={handsPositionRef} />
    </Canvas>
  );
};

export default Scene;