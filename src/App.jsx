import React, { useRef } from 'react';
import CameraView from './components/CameraView';
import Scene from './components/Scene';
import PortfolioUI from './components/PortfolioUI';

function App() {
  const handsPositionRef = useRef({ landmarks: [] });

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: 'transparent', overflow: 'hidden' }}>
      
      <CameraView handsPositionRef={handsPositionRef} />


      <svg 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}
      >
        <path 
          id="ar-mask-path" 
          fill="#050a0f" 
          fillRule="evenodd" 
          d="M 0 0 L 10000 0 L 10000 10000 L 0 10000 Z" 
          style={{ transition: 'opacity 0.8s ease-out' }}
        />
      </svg>

   
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 999, pointerEvents: 'none' }}>
        <Scene handsPositionRef={handsPositionRef} />
      </div>

     
      <PortfolioUI handsPositionRef={handsPositionRef} />

    </div>
  );
}

export default App;