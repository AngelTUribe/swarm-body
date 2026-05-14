import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import Swarm from './Swarm'; 
import SprawlParticles from './SprawlParticles';
import SpatialObjects from './SpatialObjects'; 
import SpatialDrive from './SpatialDrive'; 

const Scene = ({ handsPositionRef }) => {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
      <Swarm handsPositionRef={handsPositionRef} />
      <SprawlParticles handsPositionRef={handsPositionRef} />

      <Suspense fallback={null}>
        <SpatialObjects handsPositionRef={handsPositionRef} />
      </Suspense>
      
      <SpatialDrive handsPositionRef={handsPositionRef} />
    </Canvas>
  );
};

export default Scene;