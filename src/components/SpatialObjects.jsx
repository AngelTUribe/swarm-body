import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const SpatialObjects = ({ handsPositionRef }) => {
  const { viewport } = useThree();
  const cubesRef = useRef({});
  const holeRef = useRef();
  const slotsGroupRef = useRef(); // <-- New ref for the wireframe slots

  useFrame(() => {
    const uiState = handsPositionRef.current?.uiState;
    
    // 1. PHASE GATE: Hide everything completely during boot
    if (!uiState || uiState.phase !== 'main') {
      if (holeRef.current) holeRef.current.visible = false;
      if (slotsGroupRef.current) slotsGroupRef.current.visible = false;
      Object.values(cubesRef.current).forEach(c => c && (c.visible = false));
      return;
    }

    const to3D = (screenX, screenY) => {
      const x = (screenX / uiState.screenW) * viewport.width - (viewport.width / 2);
      const y = -(screenY / uiState.screenH) * viewport.height + (viewport.height / 2);
      return { x, y };
    };

    // 2. TOGGLE STATIC SLOTS (Hide them when a window is expanded)
    if (slotsGroupRef.current) {
      slotsGroupRef.current.visible = !uiState.isExpanded;
    }

    // 3. TARGET HOLE
    if (holeRef.current) {
      // Show the execute hole if NO window is open, OR if we are dragging a window to close it
      holeRef.current.visible = !uiState.isExpanded || uiState.dragMode === 'sticky';
      const holePos = to3D(uiState.screenW / 2, uiState.screenH * 0.85);
      holeRef.current.position.set(holePos.x, holePos.y, -0.6);
      
      const targetColor = new THREE.Color(uiState.isSnapped ? '#ffffff' : (uiState.dragMode === 'sticky' ? '#ff0055' : '#00ffcc'));
      holeRef.current.material.color.lerp(targetColor, 0.2);
      holeRef.current.material.emissive.lerp(targetColor, 0.2);
      holeRef.current.material.emissiveIntensity = uiState.isSnapped ? 3 : 0.8;
    }

    // 4. PROJECT CUBES
    Object.keys(uiState.projects).forEach((id) => {
      const cube = cubesRef.current[id];
      const pState = uiState.projects[id];
      if (cube && pState) {
        cube.visible = !uiState.isExpanded || uiState.draggedId === id;
        const pos = to3D(pState.currX, pState.currY);
        
        // SNAPPING & ALIGNMENT LOGIC
        if (uiState.draggedId === id && !uiState.isSnapped) {
           cube.rotation.x += 0.08; cube.rotation.y += 0.08;
           cube.scale.setScalar(0.7);
           // Pop out toward the camera when grabbed
           cube.position.set(pos.x, pos.y, 0.5); 
        } else {
           cube.rotation.set(0, 0, 0); 
           cube.scale.setScalar(1.0);
           // Push back to EXACTLY match the slot wireframe depth (-0.6)
           cube.position.set(pos.x, pos.y, -0.6); 
        }
      }
    });
  });

  return (
    <>
      <mesh ref={holeRef}>
        <boxGeometry args={[1.3, 1.3, 1.3]} />
        <meshStandardMaterial color="#00ffcc" wireframe emissive="#00ffcc" />
      </mesh>

      {/* Grouping the slots so we can hide them cleanly */}
      <group ref={slotsGroupRef}>
        {[-35, 0, 35].map((angle, i) => {
          const rad = (angle - 90) * (Math.PI / 180);
          const screenW = window.innerWidth; const screenH = window.innerHeight;
          const radius = Math.min(screenW, screenH) * 0.4;
          const x2d = (screenW / 2) + radius * Math.cos(rad);
          const y2d = (screenH * 0.85) + radius * Math.sin(rad);
          const vx = (x2d / screenW) * viewport.width - (viewport.width / 2);
          const vy = -(y2d / screenH) * viewport.height + (viewport.height / 2);
          return (
            <mesh key={i} position={[vx, vy, -0.6]}>
              <boxGeometry args={[1.3, 1.3, 1.3]} />
              <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.1} />
            </mesh>
          );
        })}
      </group>

      {['p1', 'p2', 'p3'].map((id) => (
        <group key={id} ref={el => cubesRef.current[id] = el}>
          <mesh><boxGeometry args={[1.2, 1.2, 1.2]} /><meshPhysicalMaterial color="#00ffcc" transmission={0.7} thickness={1} transparent opacity={0.6}/></mesh>
          <mesh><boxGeometry args={[0.8, 0.8, 0.8]} /><meshBasicMaterial color="#ffffff" wireframe /></mesh>
        </group>
      ))}
      <ambientLight intensity={1} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
    </>
  );
};

export default SpatialObjects;