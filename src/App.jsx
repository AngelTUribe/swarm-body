import React, { useRef } from 'react';
import CameraView from './components/CameraView';
import Scene from './components/Scene';

function App() {
  const nosePositionRef = useRef({ x: 0.5, y: 0.5, z: 0 });

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#111' }}>
      
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
        <Scene nosePositionRef={nosePositionRef} />
      </div>

      <div style={{ position: 'absolute', top: 20, right: 20, width: '240px', zIndex: 10, borderRadius: '10px', overflow: 'hidden' }}>
        <CameraView nosePositionRef={nosePositionRef} />
      </div>

    </div>
  );
}

export default App;