import React, { useRef } from 'react';
import CameraView from './components/CameraView';
import Scene from './components/Scene';
import PortfolioUI from './components/PortfolioUI';

function App() {
  const handsPositionRef = useRef({ landmarks: [] });

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: 'transparent', overflow: 'hidden' }}>
      
      {/* 1. Camera in the very back (zIndex 0) */}
      <CameraView handsPositionRef={handsPositionRef} />

      {/* 2. 3D Hand Mesh in the middle (zIndex 1) */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
        <Scene handsPositionRef={handsPositionRef} />
      </div>

      {/* 3. Interactive UI on top (zIndex 10) */}
      <PortfolioUI handsPositionRef={handsPositionRef} />

    </div>
  );
}

export default App;