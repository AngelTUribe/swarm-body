import React from 'react';
import { Canvas } from '@react-three/fiber';
import Swarm from './Swarm'; 
import ParticleWake from './ParticleWake'; // <-- 1. Import it

const Scene = ({ handsPositionRef }) => {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
      
      {/* Your Volumetric Cyan Hand */}
      <Swarm handsPositionRef={handsPositionRef} />

      {/* 2. Your Hot Pink Particle Emitter */}
      <ParticleWake handsPositionRef={handsPositionRef} />

    </Canvas>
  );
};

export default Scene;