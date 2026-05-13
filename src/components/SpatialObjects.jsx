import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

// Store the display text mapped to your project IDs
const PROJECT_INFO = {
  p1: { title: 'INTERACTIVE\nPORTFOLIO', sub: 'WEB.DEV // 01' },
  p2: { title: 'ENGINEERING\nRESUME', sub: 'DOC.SYS // 02' },
  p3: { title: 'SPATIAL\nDRIVE', sub: 'SYS.RENDER // 03' }
};

const SpatialObjects = ({ handsPositionRef }) => {
  const { viewport } = useThree();
  const cubesRef = useRef({});
  const slotRefs = useRef({}); 
  const holeRef = useRef();

  useFrame(() => {
    const uiState = handsPositionRef.current?.uiState;
    
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

    // 1. RENDER EXECUTE HOLE
    if (holeRef.current && uiState.holeCurrX !== undefined) {
      holeRef.current.visible = true;
      const targetHole3D = to3D(uiState.holeCurrX, uiState.holeCurrY);
      
      holeRef.current.position.x = targetHole3D.x;
      holeRef.current.position.y = targetHole3D.y;
      holeRef.current.position.z = -0.6;
      
      const targetColor = new THREE.Color(uiState.isSnapped ? '#ffffff' : (uiState.layout === 'split' ? '#ff0055' : '#00ffcc'));
      holeRef.current.material.color.lerp(targetColor, 0.2);
      holeRef.current.material.emissive.lerp(targetColor, 0.2);
      holeRef.current.material.emissiveIntensity = uiState.isSnapped ? 3 : 0.8;
    }

    // 2. RENDER CUBES AND SLOTS
    Object.keys(uiState.projects).forEach((id) => {
      const pState = uiState.projects[id];
      
      // A. Empty Slot Wireframes
      if (pState.slotCurrX !== undefined) {
        const targetSlot3D = to3D(pState.slotCurrX, pState.slotCurrY);
        const slot = slotRefs.current[id];
        if (slot) {
          slot.visible = true;
          slot.position.x = targetSlot3D.x;
          slot.position.y = targetSlot3D.y;
          slot.position.z = -0.6;
        }
      }

      // B. Physical Glass Cubes
      const cube = cubesRef.current[id];
      if (cube) {
        cube.visible = true;
        const pos = to3D(pState.currX, pState.currY);
        
        cube.position.x = pos.x; 
        cube.position.y = pos.y;
        
        if (uiState.draggedId === id && !uiState.isSnapped) {
           cube.rotation.x += 0.08; 
           cube.rotation.y += 0.08;
           cube.scale.setScalar(0.7);
           cube.position.z = 0.5; 
        } else {
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

      {['p1', 'p2', 'p3'].map((id) => (
        <mesh key={`slot-${id}`} ref={el => slotRefs.current[id] = el}>
          <boxGeometry args={[1.25, 1.25, 1.25]} />
          <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.1} />
        </mesh>
      ))}

      {['p1', 'p2', 'p3'].map((id) => (
        <group key={id} ref={el => cubesRef.current[id] = el}>
          {/* Outer Glass Shell */}
          <mesh>
            <boxGeometry args={[1.2, 1.2, 1.2]} />
            <meshPhysicalMaterial color="#00ffcc" transmission={0.7} thickness={1} transparent opacity={0.6}/>
          </mesh>
          
          {/* Inner Wireframe Core */}
          <mesh>
            <boxGeometry args={[0.8, 0.8, 0.8]} />
            <meshBasicMaterial color="#ffffff" wireframe />
          </mesh>

          {/* FRONT FACE TEXT */}
          <group position={[0, 0, 0.61]}>
            <Text
              position={[0, 0.15, 0]}
              fontSize={0.16}
              color="#ffffff"
              font="/FiraMono-Regular.ttf"
              anchorX="center"
              anchorY="middle"
              textAlign="center"
              lineHeight={1.2}
            >
              {PROJECT_INFO[id].title}
            </Text>
            <Text
              position={[0, -0.3, 0]}
              fontSize={0.09}
              color="#00ffcc"
             font="/FiraMono-Regular.ttf"
              anchorX="center"
              anchorY="middle"
            >
              {PROJECT_INFO[id].sub}
            </Text>
          </group>

          {/* REAR FACE TEXT (Visible when you spin the cube) */}
          <group position={[0, 0, -0.61]} rotation={[0, Math.PI, 0]}>
            <Text
              position={[0, 0.15, 0]}
              fontSize={0.16}
              color="#ffffff"
              font="/FiraMono-Regular.ttf"
              anchorX="center"
              anchorY="middle"
              textAlign="center"
              lineHeight={1.2}
            >
              {PROJECT_INFO[id].title}
            </Text>
            <Text
  position={[0, 0.15, 0]}
  fontSize={0.16}
  color="#ffffff"
  font="/FiraMono-Regular.ttf"
  anchorX="center"
  anchorY="middle"
  textAlign="center"
  lineHeight={1.2}
>
  {PROJECT_INFO[id].title}
</Text>
          </group>
        </group>
      ))}
      <ambientLight intensity={1} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
    </>
  );
};

export default SpatialObjects;