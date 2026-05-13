import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// 1. THE 3D ENGINE
const BuilderScene = ({ handsPositionRef, currentColor, setCubes, cubes }) => {
  const { camera, raycaster, scene } = useThree();
  const ghostCubeRef = useRef();
  const planeRef = useRef();
  const cubesGroupRef = useRef();
  
  const isPinchingRef = useRef(false);
  const prevPinchRef = useRef(false);
  
  // Camera orbit state
  const orbitState = useRef({ radius: 15, theta: Math.PI / 4, phi: Math.PI / 3, lastX: null, lastY: null });

  useEffect(() => {
    camera.position.setFromSphericalCoords(orbitState.current.radius, orbitState.current.phi, orbitState.current.theta);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useFrame(() => {
    const hands = handsPositionRef.current?.landmarks || [];
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // These match the dimensions of your Expanded Window from PortfolioUI
    const winLeft = screenW * 0.25;
    const winTop = screenH * 0.15;
    const winWidth = screenW * 0.5;
    const winHeight = screenH * 0.7;

    let handA = hands[0]; 
    let handB = hands[1]; 

    // === HAND A: ROTATE THE WORLD ===
    if (handA) {
      const thumb = handA[4];
      const index = handA[8];
      const isPinching = Math.hypot((thumb.x - index.x)*screenW, (thumb.y - index.y)*screenH) < 45;
      
      if (isPinching) {
        if (orbitState.current.lastX !== null) {
          const deltaX = index.x - orbitState.current.lastX;
          const deltaY = index.y - orbitState.current.lastY;
          
          orbitState.current.theta -= deltaX * 5; 
          orbitState.current.phi -= deltaY * 5;
          orbitState.current.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, orbitState.current.phi)); // Stop camera from going underground
          
          camera.position.setFromSphericalCoords(orbitState.current.radius, orbitState.current.phi, orbitState.current.theta);
          camera.lookAt(0, 0, 0);
        }
        orbitState.current.lastX = index.x;
        orbitState.current.lastY = index.y;
      } else {
        orbitState.current.lastX = null;
      }
    }

    // === HAND B: SPATIAL RAYCAST & BUILD ===
    if (handB) {
      const thumb = handB[4];
      const index = handB[8];
      
      const ix = (1 - index.x) * screenW;
      const iy = index.y * screenH;
      const tx = (1 - thumb.x) * screenW;
      const ty = thumb.y * screenH;
      
      const isPinching = Math.hypot(tx - ix, ty - iy) < 45;
      isPinchingRef.current = isPinching;

      // Translate global screen coordinates to local window coordinates
      const localX = ix - winLeft;
      const localY = iy - winTop;

      let isHoveringWindow = (localX >= 0 && localX <= winWidth && localY >= 0 && localY <= winHeight);

      if (isHoveringWindow) {
        // Convert to Normalized Device Coordinates (-1 to +1)
        const ndcX = (localX / winWidth) * 2 - 1;
        const ndcY = -(localY / winHeight) * 2 + 1;

        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
        
        // Grab the floor and all existing cubes to check for collisions
        const targets = [];
        if (planeRef.current) targets.push(planeRef.current);
        if (cubesGroupRef.current) targets.push(...cubesGroupRef.current.children);
        
        const intersects = raycaster.intersectObjects(targets, false);

        if (intersects.length > 0) {
          const hit = intersects[0];
          
          // Calculate grid placement by pushing slightly OUT of the face we hit
          const pos = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(0.5));
          
          // Snap to exactly 1x1x1 grid
          pos.x = Math.floor(pos.x) + 0.5;
          pos.y = Math.floor(pos.y) + 0.5;
          pos.z = Math.floor(pos.z) + 0.5;

          if (ghostCubeRef.current) {
            ghostCubeRef.current.position.copy(pos);
            ghostCubeRef.current.visible = true;
          }

          // Execute build on edge-trigger pinch!
          if (isPinching && !prevPinchRef.current) {
            if (pos.y > 0) { // Don't build underground
              setCubes(prev => [...prev, { position: [pos.x, pos.y, pos.z], color: currentColor }]);
            }
          }
        } else {
          if (ghostCubeRef.current) ghostCubeRef.current.visible = false;
        }
      } else {
        if (ghostCubeRef.current) ghostCubeRef.current.visible = false;
      }

      prevPinchRef.current = isPinching;
    }
  });

  return (
    <group>
      {/* Ground Plane */}
      <mesh ref={planeRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <gridHelper args={[20, 20, '#00ffcc', '#00ffcc']} position={[0, 0.01, 0]} material-opacity={0.3} material-transparent />

      {/* Render All Placed Cubes */}
      <group ref={cubesGroupRef}>
        {cubes.map((c, i) => (
          <mesh key={i} position={c.position}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={c.color} />
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(1, 1, 1)]} />
              <lineBasicMaterial color="#000" linewidth={2} />
            </lineSegments>
          </mesh>
        ))}
      </group>

      {/* Holographic Aiming Cursor */}
      <mesh ref={ghostCubeRef} visible={false}>
        <boxGeometry args={[1.02, 1.02, 1.02]} />
        <meshBasicMaterial color={currentColor} transparent opacity={0.6} depthWrite={false} />
      </mesh>
      
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} />
    </group>
  );
};

// 2. THE 2D UI WRAPPER
const VoxelBuilder = ({ handsPositionRef }) => {
  const [cubes, setCubes] = useState([]);
  const [currentColor, setCurrentColor] = useState('#00ffcc');
  
  const colors = ['#00ffcc', '#ff0055', '#ffff00', '#0055ff', '#ffffff', '#222222'];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      
      {/* 3D Viewport */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: 'rgba(5, 10, 15, 0.5)' }}>
         <Canvas style={{ width: '100%', height: '100%' }}>
            <BuilderScene handsPositionRef={handsPositionRef} currentColor={currentColor} setCubes={setCubes} cubes={cubes} />
         </Canvas>
      </div>

      {/* Control Panel Toolbar */}
      <div style={{ height: '70px', borderTop: '1px solid rgba(0, 255, 204, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', pointerEvents: 'auto', zIndex: 9999 }}>
         
         {/* Color Picker */}
         <div style={{ display: 'flex', gap: '15px' }}>
            {colors.map(c => (
              <button 
                key={c} onClick={() => setCurrentColor(c)}
                style={{ 
                  width: '35px', height: '35px', borderRadius: '50%', backgroundColor: c, 
                  border: currentColor === c ? '3px solid #fff' : '1px solid #555',
                  cursor: 'pointer', boxShadow: currentColor === c ? `0 0 10px ${c}` : 'none'
                }} 
              />
            ))}
         </div>

         {/* Instructions */}
         <div style={{ color: '#fff', fontSize: '0.9rem', textAlign: 'center', lineHeight: '1.4', fontFamily: 'monospace' }}>
            <b>Hand 1:</b> Pinch & Drag to orbit camera<br/>
            <b>Hand 2:</b> Aim and Pinch to place block
         </div>

         {/* Clear Button */}
         <button 
           onClick={() => setCubes([])}
           style={{ padding: '8px 20px', backgroundColor: 'transparent', border: '1px solid #ff0055', color: '#ff0055', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
         >
           CLEAR
         </button>

      </div>
    </div>
  )
};

export default VoxelBuilder;