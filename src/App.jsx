import React, { useRef } from 'react';
import CameraView from './components/CameraView';
import Scene from './components/Scene';
import PortfolioUI from './components/PortfolioUI'; // 1. Import it

function App() {
  const handsPositionRef = useRef({ landmarks: [] });

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#111', overflow: 'hidden' }}>
      
      {/* 3D Hand Mesh */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
        <Scene handsPositionRef={handsPositionRef} />
      </div>

      {/* NEW: 2D Interactive Portfolio Interface */}
      <PortfolioUI handsPositionRef={handsPositionRef} />

      {/* Camera View */}
      <div style={{ position: 'absolute', top: 20, right: 20, width: '240px', zIndex: 10, borderRadius: '10px', overflow: 'hidden' }}>
        <CameraView handsPositionRef={handsPositionRef} />
      </div>

    </div>
  );
}

export default App;