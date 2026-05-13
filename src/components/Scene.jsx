import React from 'react';
import { Canvas } from '@react-three/fiber';
import Swarm from './Swarm'; 
import SprawlParticles from './SprawlParticles';
import SpatialObjects from './SpatialObjects'; 
import NeonBuilder from './NeonBuilder'; // <--- 1. IMPORT IT HERE

const Scene = ({ handsPositionRef }) => {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
      <Swarm handsPositionRef={handsPositionRef} />
      <SprawlParticles handsPositionRef={handsPositionRef} />
      <SpatialObjects handsPositionRef={handsPositionRef} />
      
      {/* 2. DROP IT IN THE SCENE */}
      <NeonBuilder handsPositionRef={handsPositionRef} />
    </Canvas>
  );
};

export default Scene;