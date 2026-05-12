import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const SpatialObjects = ({ handsPositionRef }) => {
  const { viewport } = useThree();
  const cubesRef = useRef({});
  const slotRefs = useRef({}); // Individual refs for animating slots
  const holeRef = useRef();

  useFrame(() => {
    const uiState = handsPositionRef.current?.uiState;
    
    // Hide everything before boot finishes
    if (!uiState || uiState.phase !== 'main') {
      if (holeRef.current) holeRef.current.visible = false;
      Object.values(slotRefs.current).forEach(s => s && (s.visible = false));
      Object.values(cubesRef.current).forEach(c => c && (c.visible = false));
      return;
    }

    const to3D = (screenX, screenY) => {
      const x = (screenX / uiState.screenW) * viewport.width - (viewport.width / 2);
      const y = -(screenY / uiState.screenH) * viewport.height + (viewport.height / 2);
      return { x, y };
    };

    // 1. ANIMATE THE EXECUTE HOLE
    if (holeRef.current && uiState.holePos) {
      holeRef.current.visible = true;
      const targetHole3D = to3D(uiState.holePos.x, uiState.holePos.y);
      
      // Smooth 3D Lerp for the Hole outline
      holeRef.current.position.x += (targetHole3D.x - holeRef.current.position.x) * 0.1;
      holeRef.current.position.y += (targetHole3D.y - holeRef.current.position.y) * 0.1;
      holeRef.current.position.z = -0.6;
      
      const targetColor = new THREE.Color(uiState.isSnapped ? '#ffffff' : (uiState.layout === 'split' ? '#ff0055' : '#00ffcc'));
      holeRef.current.material.color.lerp(targetColor, 0.2);
      holeRef.current.material.emissive.lerp(targetColor, 0.2);
      holeRef.current.material.emissiveIntensity = uiState.isSnapped ? 3 : 0.8;
    }

    // 2. ANIMATE CUBES AND SLOTS
    Object.keys(uiState.projects).forEach((id) => {
      const pState = uiState.projects[id];
      
      // A. Move the Empty Slot Wireframes
      if (pState.slotPos) {
        const targetSlot3D = to3D(pState.slotPos.x, pState.slotPos.y);
        const slot = slotRefs.current[id];
        if (slot) {
          slot.visible = true;
          slot.position.x += (targetSlot3D.x - slot.position.x) * 0.1;
          slot.position.y += (targetSlot3D.y - slot.position.y) * 0.1;
          slot.position.z = -0.6;
        }
      }

      // B. Move the Physical Glass Cubes
      const cube = cubesRef.current[id];
      if (cube) {
        cube.visible = true;
        
        // Cube 2D coordinates are already lerped beautifully in PortfolioUI, 
        // so we just map them directly to 3D.
        const pos = to3D(pState.currX, pState.currY);
        cube.position.x = pos.x; 
        cube.position.y = pos.y;
        
        if (uiState.draggedId === id && !uiState.isSnapped) {
           // When grabbed, spin and pop out
           cube.rotation.x += 0.08; cube.rotation.y += 0.08;
           cube.scale.setScalar(0.7);
           cube.position.z = 0.5; 
        } else {
           // When docked, lock rotation and drop back into slot
           cube.rotation.set(0, 0, 0); 
           cube.scale.setScalar(1.0);
           cube.position.z = -0.6; 
        }
      }
    });
  });

  return (
    <>
      <mesh ref={holeRef}>
        <boxGeometry args={[1.25, 1.25, 1.25]} />
        <meshStandardMaterial color="#00ffcc" wireframe emissive="#00ffcc" />
      </mesh>

      {/* RENDER DYNAMIC SLOTS USING REFS */}
      {['p1', 'p2', 'p3'].map((id) => (
        <mesh key={`slot-${id}`} ref={el => slotRefs.current[id] = el}>
          <boxGeometry args={[1.25, 1.25, 1.25]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.1} />
        </mesh>
      ))}

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