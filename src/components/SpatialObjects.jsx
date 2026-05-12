import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const SpatialObjects = ({ handsPositionRef }) => {
  const { viewport, size } = useThree();
  const cubesRef = useRef({});
  const holeRef = useRef();

  useFrame(() => {
    const uiState = handsPositionRef.current?.uiState;
    if (!uiState || uiState.phase !== 'main') {
      // Hide everything if we are booting or in a window
      if (holeRef.current) holeRef.current.visible = false;
      Object.values(cubesRef.current).forEach(c => c && (c.visible = false));
      return;
    }

    // Helper to map screen pixels to 3D Viewport
    const to3D = (screenX, screenY) => {
      const x = (screenX / uiState.screenW) * viewport.width - (viewport.width / 2);
      const y = -(screenY / uiState.screenH) * viewport.height + (viewport.height / 2);
      return { x, y };
    };

    // 1. Render the Execute Hole
    if (holeRef.current) {
      holeRef.current.visible = !uiState.isExpanded;
      const holePos = to3D(uiState.screenW / 2, uiState.screenH * 0.85);
      holeRef.current.position.set(holePos.x, holePos.y, -0.5); // Pushed slightly back
      
      // Spin the hole slowly for sci-fi effect
      holeRef.current.rotation.z += 0.01;
      holeRef.current.rotation.x = Math.sin(Date.now() * 0.001) * 0.2;
    }

    // 2. Render the Glass Cubes
    Object.keys(uiState.projects).forEach((id) => {
      const cube = cubesRef.current[id];
      const pState = uiState.projects[id];
      if (cube && pState) {
        cube.visible = !uiState.isExpanded;
        const pos = to3D(pState.currX, pState.currY);
        
        // Move cube to physical position
        cube.position.set(pos.x, pos.y, uiState.draggedId === id ? 1 : 0); // Pop forward if dragged
        
        // Rotate cubes dynamically
        if (uiState.draggedId === id) {
           cube.rotation.x += 0.05;
           cube.rotation.y += 0.05;
           cube.scale.setScalar(1.2); // Grow when grabbed
        } else {
           cube.rotation.x = Math.sin(Date.now() * 0.001 + pos.x) * 0.2;
           cube.rotation.y += 0.005;
           cube.scale.setScalar(1.0);
        }
      }
    });
  });

  // Futuristic Glass Material
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#00ffcc',
    transmission: 0.9, // True glass transparency
    opacity: 1,
    metalness: 0.2,
    roughness: 0.1,
    thickness: 1.5,
    side: THREE.DoubleSide,
  });

  return (
    <>
      {/* THE GEOMETRIC EXECUTE HOLE */}
      <mesh ref={holeRef}>
        {/* A hollowed out torus/square that the cube slots into */}
        <torusGeometry args={[0.8, 0.1, 16, 4]} />
        <meshStandardMaterial color="#ff0055" wireframe emissive="#ff0055" emissiveIntensity={0.5} />
      </mesh>

      {/* THE 3 PROJECT CUBES */}
      {['p1', 'p2', 'p3'].map((id) => (
        <group key={id} ref={el => cubesRef.current[id] = el}>
          {/* Outer Glass Shell */}
          <mesh material={glassMaterial}>
            <boxGeometry args={[1.2, 1.2, 1.2]} />
          </mesh>
          {/* Inner Wireframe Core */}
          <mesh>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
            <meshBasicMaterial color="#ffffff" wireframe />
          </mesh>
        </group>
      ))}
      
      {/* Need lights for the glass to look realistic */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={2} />
    </>
  );
};

export default SpatialObjects;