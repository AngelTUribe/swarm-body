import React from 'react';
import { Canvas } from '@react-three/fiber';
import Swarm from './Swarm'; 
import SprawlParticles from './SprawlParticles';
import SpatialObjects from './SpatialObjects'; // <-- Import the new cubes!

const Scene = ({ handsPositionRef }) => {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
      <Swarm handsPositionRef={handsPositionRef} />
      <SprawlParticles handsPositionRef={handsPositionRef} />
      
      {/* Inject the 3D Cubes and the Execute Hole */}
      <SpatialObjects handsPositionRef={handsPositionRef} />
    </Canvas>
  );
};

export default Scene;