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

    // 1. SMART POCKET (Execute Box)
    if (holeRef.current) {
      holeRef.current.visible = !uiState.isExpanded || uiState.dragMode === 'sticky';
      const holePos = to3D(uiState.screenW / 2, uiState.screenH * 0.85);
      holeRef.current.position.set(holePos.x, holePos.y, -0.6); 
      
      // Still and responsive
      const targetColor = new THREE.Color(uiState.isSnapped ? '#ffffff' : (uiState.dragMode === 'sticky' ? '#ff0055' : '#00ffcc'));
      holeRef.current.material.color.lerp(targetColor, 0.2);
      holeRef.current.material.emissive.lerp(targetColor, 0.2);
      holeRef.current.material.emissiveIntensity = uiState.isSnapped ? 2.5 : 0.8;
    }

    // 2. PROJECT CUBES
    Object.keys(uiState.projects).forEach((id) => {
      const cube = cubesRef.current[id];
      const pState = uiState.projects[id];
      if (cube && pState) {
        cube.visible = !uiState.isExpanded || uiState.draggedId === id;
        const pos = to3D(pState.currX, pState.currY);
        cube.position.set(pos.x, pos.y, uiState.draggedId === id ? 1 : 0); 
        
        if (uiState.draggedId === id) {
           cube.rotation.x += 0.05; cube.rotation.y += 0.05;
           cube.scale.setScalar(0.7); // Shrink when grabbed
        } else {
           cube.rotation.set(0, 0, 0); // Still when docked
           cube.scale.setScalar(1.0);
        }
      }
    });
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#00ffcc', transmission: 0.9, opacity: 1, metalness: 0.2, roughness: 0.1, thickness: 1.5, side: THREE.DoubleSide,
  });

  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const radius = Math.min(screenW, screenH) * 0.4; 
  const angles = [-35, 0, 35]; 

  return (
    <>
      {/* EXECUTE DOCKING HOLE */}
      <mesh ref={holeRef}>
        <boxGeometry args={[1.3, 1.3, 1.3]} />
        <meshStandardMaterial color="#00ffcc" wireframe emissive="#00ffcc" emissiveIntensity={0.8} />
      </mesh>

      {/* STATIC DOCKING SLOTS */}
      {angles.map((angle, index) => {
        const rad = (angle - 90) * (Math.PI / 180);
        const x2d = (screenW / 2) + radius * Math.cos(rad);
        const y2d = (screenH * 0.85) + radius * Math.sin(rad);
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