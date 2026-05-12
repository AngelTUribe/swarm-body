import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const SpatialObjects = ({ handsPositionRef }) => {
  const { viewport } = useThree();
  const cubesRef = useRef({});
  const holeRef = useRef();

  useFrame(() => {
    const uiState = handsPositionRef.current?.uiState;
    if (!uiState || uiState.phase !== 'main') {
      if (holeRef.current) holeRef.current.visible = false;
      Object.values(cubesRef.current).forEach(c => c && (c.visible = false));
      return;
    }

    const to3D = (screenX, screenY) => {
      const x = (screenX / uiState.screenW) * viewport.width - (viewport.width / 2);
      const y = -(screenY / uiState.screenH) * viewport.height + (viewport.height / 2);
      return { x, y };
    };

    // 1. DYNAMIC SMART POCKET (Execute vs Incinerator)
    if (holeRef.current) {
      // Hide the pocket if a window is open AND we aren't holding a cube
      holeRef.current.visible = !uiState.isExpanded || uiState.dragMode === 'sticky';
      
      const holePos = to3D(uiState.screenW / 2, uiState.screenH * 0.85);
      holeRef.current.position.set(holePos.x, holePos.y, -0.5); 
      
      holeRef.current.rotation.z += 0.01;
      holeRef.current.rotation.x = Math.sin(Date.now() * 0.001) * 0.2;

      // Color Shift Logic
      const isIncinerator = uiState.dragMode === 'sticky';
      const pocketColor = new THREE.Color(isIncinerator ? '#ff0055' : '#00ffcc');
      holeRef.current.material.color.lerp(pocketColor, 0.1);
      holeRef.current.material.emissive.lerp(pocketColor, 0.1);
    }

    // 2. RENDER THE GLASS CUBES
    Object.keys(uiState.projects).forEach((id) => {
      const cube = cubesRef.current[id];
      const pState = uiState.projects[id];
      if (cube && pState) {
        // Hide all cubes when a window is open, UNLESS this is the specific cube we just turned the window into!
        cube.visible = !uiState.isExpanded || uiState.draggedId === id;
        
        const pos = to3D(pState.currX, pState.currY);
        cube.position.set(pos.x, pos.y, uiState.draggedId === id ? 1 : 0); 
        
        if (uiState.draggedId === id) {
           // Spin fast when dragged
           cube.rotation.x += 0.05; cube.rotation.y += 0.05;
           cube.scale.setScalar(1.2); 
        } else {
           // Float idle in the slot
           cube.rotation.x = Math.sin(Date.now() * 0.001 + pos.x) * 0.2;
           cube.rotation.y += 0.005;
           cube.scale.setScalar(1.0);
        }
      }
    });
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#00ffcc', transmission: 0.9, opacity: 1, metalness: 0.2, roughness: 0.1, thickness: 1.5, side: THREE.DoubleSide,
  });

  // Calculate generic slot positions based on initial mount
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const centerX = screenW / 2;
  const centerY = screenH * 0.85; 
  const radius = Math.min(screenW, screenH) * 0.4; 
  const angles = [-35, 0, 35]; 

  return (
    <>
      {/* SMART POCKET (Changes color dynamically) */}
      <mesh ref={holeRef}>
        <torusGeometry args={[0.8, 0.1, 16, 4]} />
        <meshStandardMaterial color="#00ffcc" wireframe emissive="#00ffcc" emissiveIntensity={0.8} />
      </mesh>

      {/* STATIC WIREFRAME SLOTS (Where the cubes belong) */}
      {angles.map((angle, index) => {
        const rad = (angle - 90) * (Math.PI / 180);
        // Map 2D to 3D Viewport exactly like the loop does
        const x2d = centerX + radius * Math.cos(rad);
        const y2d = centerY + radius * Math.sin(rad);
        const vx = (x2d / screenW) * viewport.width - (viewport.width / 2);
        const vy = -(y2d / screenH) * viewport.height + (viewport.height / 2);
        
        return (
          <mesh key={`slot-${index}`} position={[vx, vy, -0.6]}>
             <boxGeometry args={[1.3, 1.3, 1.3]} />
             <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.15} />
          </mesh>
        );
      })}

      {/* THE 3 PROJECT CUBES */}
      {['p1', 'p2', 'p3'].map((id) => (
        <group key={id} ref={el => cubesRef.current[id] = el}>
          <mesh material={glassMaterial}><boxGeometry args={[1.2, 1.2, 1.2]} /></mesh>
          <mesh><boxGeometry args={[0.8, 0.8, 0.8]} /><meshBasicMaterial color="#ffffff" wireframe /></mesh>
        </group>
      ))}
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={2} />
    </>
  );
};

export default SpatialObjects;