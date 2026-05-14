import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

const SpatialDrive = ({ handsPositionRef }) => {
  const gameGroupRef = useRef();
  const wheelGroupRef = useRef();
  const carRef = useRef();
  const steeringWheelRef = useRef();
  
  // New Pedal Refs
  const gasPedalRef = useRef();
  const brakePedalRef = useRef();
  const isGasRef = useRef(false);
  const isBrakeRef = useRef(false);
  
  const ambientLightRef = useRef();
  const dirLightRef = useRef();
  
  const activeHandMemory = useRef({ position: null, locked: false, lostFrames: 0 });
  const speedRef = useRef(0);
  const angleRef = useRef(Math.PI / 2); 
  const steerInputRef = useRef(0); 

  // Lap Tracking State
  const [laps, setLaps] = useState(0);
  const checkpointRef = useRef(false);
  const lastX = useRef(-2);

  // Particle System
  const particleCount = 100;
  const particlesRef = useRef();
  const pData = useRef(Array.from({length: particleCount}, () => ({ x:1000, y:1000, z:1000, vx:0, vy:0, vz:0, life: 0 })));

  const straightLength = 6;
  const innerRadius = 4;
  const outerRadius = 9;

  const checkerTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillRect(64, 64, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.5, 4); 
    return texture;
  }, []);

  const trackShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-straightLength, outerRadius);
    shape.lineTo(straightLength, outerRadius);
    shape.absarc(straightLength, 0, outerRadius, Math.PI/2, -Math.PI/2, true);
    shape.lineTo(-straightLength, -outerRadius);
    shape.absarc(-straightLength, 0, outerRadius, -Math.PI/2, Math.PI/2, true);

    const hole = new THREE.Path();
    hole.moveTo(-straightLength, innerRadius);
    hole.lineTo(straightLength, innerRadius);
    hole.absarc(straightLength, 0, innerRadius, Math.PI/2, -Math.PI/2, true);
    hole.lineTo(-straightLength, -innerRadius);
    hole.absarc(-straightLength, 0, innerRadius, -Math.PI/2, Math.PI/2, true);
    shape.holes.push(hole);
    return shape;
  }, [straightLength, innerRadius, outerRadius]);

  const grassShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-straightLength, innerRadius);
    shape.lineTo(straightLength, innerRadius);
    shape.absarc(straightLength, 0, innerRadius, Math.PI/2, -Math.PI/2, true);
    shape.lineTo(-straightLength, -innerRadius);
    shape.absarc(-straightLength, 0, innerRadius, -Math.PI/2, Math.PI/2, true);
    return shape;
  }, [straightLength, innerRadius]);

  // Fitted Outer Grass Shape
  const outerGrassShape = useMemo(() => {
    const shape = new THREE.Shape();
    const padR = outerRadius + 6; 
    shape.moveTo(-straightLength, padR);
    shape.lineTo(straightLength, padR);
    shape.absarc(straightLength, 0, padR, Math.PI/2, -Math.PI/2, true);
    shape.lineTo(-straightLength, -padR);
    shape.absarc(-straightLength, 0, padR, -Math.PI/2, Math.PI/2, true);
    return shape;
  }, [straightLength, outerRadius]);

  const outerWallShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-straightLength, outerRadius + 0.4);
    shape.lineTo(straightLength, outerRadius + 0.4);
    shape.absarc(straightLength, 0, outerRadius + 0.4, Math.PI/2, -Math.PI/2, true);
    shape.lineTo(-straightLength, -(outerRadius + 0.4));
    shape.absarc(-straightLength, 0, outerRadius + 0.4, -Math.PI/2, Math.PI/2, true);

    const hole = new THREE.Path();
    hole.moveTo(-straightLength, outerRadius);
    hole.lineTo(straightLength, outerRadius);
    hole.absarc(straightLength, 0, outerRadius, Math.PI/2, -Math.PI/2, true);
    hole.lineTo(-straightLength, -outerRadius);
    hole.absarc(-straightLength, 0, outerRadius, -Math.PI/2, Math.PI/2, true);
    shape.holes.push(hole);
    return shape;
  }, [straightLength, outerRadius]);

  const innerWallShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-straightLength, innerRadius);
    shape.lineTo(straightLength, innerRadius);
    shape.absarc(straightLength, 0, innerRadius, Math.PI/2, -Math.PI/2, true);
    shape.lineTo(-straightLength, -innerRadius);
    shape.absarc(-straightLength, 0, innerRadius, -Math.PI/2, Math.PI/2, true);

    const hole = new THREE.Path();
    hole.moveTo(-straightLength, innerRadius - 0.4);
    hole.lineTo(straightLength, innerRadius - 0.4);
    hole.absarc(straightLength, 0, innerRadius - 0.4, Math.PI/2, -Math.PI/2, true);
    hole.lineTo(-straightLength, -(innerRadius - 0.4));
    hole.absarc(-straightLength, 0, innerRadius - 0.4, -Math.PI/2, Math.PI/2, true);
    shape.holes.push(hole);
    return shape;
  }, [straightLength, innerRadius]);

  // Procedural Arrows for Track Direction
  const trackArrows = useMemo(() => {
    const arr = [];
    const midR = (innerRadius + outerRadius) / 2; 
    
    // Top Straight (Moving Right)
    arr.push({ pos: [-3, -0.08, midR], angle: Math.PI/2 });
    arr.push({ pos: [3, -0.08, midR], angle: Math.PI/2 });
    
    // Right Curve
    arr.push({ pos: [straightLength + midR * 0.707, -0.08, midR * 0.707], angle: 3*Math.PI/4 });
    arr.push({ pos: [straightLength + midR, -0.08, 0], angle: Math.PI }); 
    arr.push({ pos: [straightLength + midR * 0.707, -0.08, -midR * 0.707], angle: 5*Math.PI/4 });
    
    // Bottom Straight (Moving Left)
    arr.push({ pos: [3, -0.08, -midR], angle: 3*Math.PI/2 });
    arr.push({ pos: [-3, -0.08, -midR], angle: 3*Math.PI/2 });
    
    // Left Curve
    arr.push({ pos: [-straightLength - midR * 0.707, -0.08, -midR * 0.707], angle: 7*Math.PI/4 });
    arr.push({ pos: [-straightLength - midR, -0.08, 0], angle: 0 });
    arr.push({ pos: [-straightLength - midR * 0.707, -0.08, midR * 0.707], angle: Math.PI/4 });
    
    return arr;
  }, [straightLength, innerRadius, outerRadius]);

  const isFist = (hand) => {
    const wrist = hand[0];
    const tips = [8, 12, 16, 20];
    let curled = 0;
    tips.forEach(t => {
       const tipDist = Math.hypot(hand[t].x - wrist.x, hand[t].y - wrist.y);
       const knuckleDist = Math.hypot(hand[t-3].x - wrist.x, hand[t-3].y - wrist.y);
       if (tipDist < knuckleDist) curled++;
    });
    return curled >= 3;
  };

  const isOpenPalm = (hand) => {
    const wrist = hand[0];
    const tips = [8, 12, 16, 20];
    let curled = 0;
    tips.forEach(t => {
       const tipDist = Math.hypot(hand[t].x - wrist.x, hand[t].y - wrist.y);
       const knuckleDist = Math.hypot(hand[t-3].x - wrist.x, hand[t-3].y - wrist.y);
       if (tipDist < knuckleDist) curled++;
    });
    return curled === 0;
  };

  useFrame(() => {
    const uiState = handsPositionRef.current?.uiState;
    const isActive = uiState && uiState.expandedId === 'p3';

    if (gameGroupRef.current) gameGroupRef.current.visible = isActive;
    if (wheelGroupRef.current) wheelGroupRef.current.visible = isActive;
    
    if (ambientLightRef.current) ambientLightRef.current.intensity = isActive ? 0.8 : 0;
    if (dirLightRef.current) dirLightRef.current.intensity = isActive ? 2.0 : 0;

    if (!isActive) return;

    const hands = handsPositionRef.current?.landmarks || [];
    const screenW = window.innerWidth;

    let activeHand = null;

    if (activeHandMemory.current.locked && activeHandMemory.current.position) {
      const lastPos = activeHandMemory.current.position;
      let bestHand = null;
      let minDist = Infinity;

      hands.forEach(h => {
        if (!h[8]) return;
        const dist = Math.hypot(h[8].x - lastPos.x, h[8].y - lastPos.y);
        if (dist < minDist) { minDist = dist; bestHand = h; }
      });

      if (bestHand && minDist < 0.2) {
        activeHand = bestHand;
        activeHandMemory.current.lostFrames = 0;
      } else {
        activeHand = null;
      }
    } else if (hands.length > 0) {
      activeHand = hands.reduce((rightmost, current) => {
        const currentScreenX = (1 - current[0].x) * screenW;
        const rightmostScreenX = (1 - rightmost[0].x) * screenW;
        return currentScreenX > rightmostScreenX ? current : rightmost;
      });
      activeHandMemory.current.locked = true;
      activeHandMemory.current.lostFrames = 0;
    }

    let steerInput = 0;
    
    // Reset pedal logic
    isGasRef.current = false;
    isBrakeRef.current = false;

    if (!activeHand) {
      activeHandMemory.current.lostFrames++;
      if (activeHandMemory.current.lostFrames > 15) {
        activeHandMemory.current.locked = false;
        activeHandMemory.current.position = null;
      }
    } else {
      activeHandMemory.current.position = activeHand[8];
      
      let acceleration = 0;
      if (isOpenPalm(activeHand)) {
          acceleration = 0.007; 
          isGasRef.current = true;
      } 
      else if (isFist(activeHand)) {
          acceleration = -0.005; 
          isBrakeRef.current = true;
      }

      const ix = (1 - activeHand[8].x) * screenW;
      
      const steeringCenter = screenW * 0.75;
      const rawSteer = (steeringCenter - ix) / (screenW * 0.20);
      steerInput = Math.max(-1, Math.min(1, rawSteer)); 
      steerInputRef.current = steerInput; 

      speedRef.current += acceleration;
      if (Math.abs(speedRef.current) > 0.001) {
        const directionMult = speedRef.current > 0 ? 1 : -1;
        angleRef.current += steerInput * 0.04 * directionMult; 
      }
    }

    speedRef.current *= 0.92; 

    // Handle Wheel Animation
    if (steeringWheelRef.current) {
        const targetRotation = -steerInputRef.current * Math.PI * 0.6;
        steeringWheelRef.current.rotation.z += (targetRotation - steeringWheelRef.current.rotation.z) * 0.15;
    }
    
    // Handle Pedal Animations
    if (gasPedalRef.current) {
        const target = isGasRef.current ? Math.PI / 6 : 0;
        gasPedalRef.current.rotation.x += (target - gasPedalRef.current.rotation.x) * 0.2;
    }
    if (brakePedalRef.current) {
        const target = isBrakeRef.current ? Math.PI / 6 : 0;
        brakePedalRef.current.rotation.x += (target - brakePedalRef.current.rotation.x) * 0.2;
    }

    if (carRef.current) {
      carRef.current.rotation.y = angleRef.current;
      
      const nextX = carRef.current.position.x + Math.sin(angleRef.current) * speedRef.current;
      const nextZ = carRef.current.position.z + Math.cos(angleRef.current) * speedRef.current;

      const clampedX = Math.max(-straightLength, Math.min(straightLength, nextX));
      const distFromCenter = Math.hypot(nextX - clampedX, nextZ);

      if (distFromCenter < innerRadius + 0.3) {
        const bounceAngle = Math.atan2(nextZ, nextX - clampedX);
        carRef.current.position.x = clampedX + Math.cos(bounceAngle) * (innerRadius + 0.3);
        carRef.current.position.z = Math.sin(bounceAngle) * (innerRadius + 0.3);
        speedRef.current *= 0.6; 
      } else if (distFromCenter > outerRadius - 0.3) {
        const bounceAngle = Math.atan2(nextZ, nextX - clampedX);
        carRef.current.position.x = clampedX + Math.cos(bounceAngle) * (outerRadius - 0.3);
        carRef.current.position.z = Math.sin(bounceAngle) * (outerRadius - 0.3);
        speedRef.current *= 0.6; 
      } else {
        carRef.current.position.x = nextX;
        carRef.current.position.z = nextZ;
      }

      // === LAP LOGIC ===
      const currentX = carRef.current.position.x;
      const currentZ = carRef.current.position.z;

      // Hit the back half of the track to validate the next lap
      if (currentZ < 0) checkpointRef.current = true;

      // Cross the finish line (X goes from negative to positive while in the bottom curve)
      if (checkpointRef.current && lastX.current < 0 && currentX >= 0 && currentZ > 0) {
        setLaps(prev => prev + 1);
        checkpointRef.current = false;
        
        // Ignite Particles
        pData.current.forEach(p => {
            p.x = 0;
            p.y = 0.5;
            p.z = (innerRadius + outerRadius) / 2;
            p.vx = (Math.random() - 0.5) * 1.5;
            p.vy = Math.random() * 1.5 + 0.5;
            p.vz = (Math.random() - 0.5) * 1.5;
            p.life = 1.0;
        });
      }
      lastX.current = currentX;
    }

    // === PARTICLE ANIMATION ===
    if (particlesRef.current) {
        const positions = particlesRef.current.geometry.attributes.position.array;
        let idx = 0;
        pData.current.forEach(p => {
            if (p.life > 0) {
                p.x += p.vx;
                p.y += p.vy;
                p.z += p.vz;
                p.vy -= 0.05; // Gravity
                p.life -= 0.02;
                positions[idx++] = p.x;
                positions[idx++] = p.y;
                positions[idx++] = p.z;
            } else {
                positions[idx++] = 1000;
                positions[idx++] = 1000;
                positions[idx++] = 1000;
            }
        });
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <>
      <group ref={gameGroupRef} position={[0.5, -1.0, -6]} scale={0.28} rotation={[Math.PI / 5, 0, 0]} visible={false}>
        
        {/* FITTED OUTER GRASS */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
            <shapeGeometry args={[outerGrassShape]} />
            <meshStandardMaterial color="#7ec850" roughness={1} />
        </mesh>

        {/* Inner Grass */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
            <shapeGeometry args={[grassShape]} />
            <meshStandardMaterial color="#68ab40" roughness={1} />
        </mesh>

        {/* Asphalt Oval Track */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
            <shapeGeometry args={[trackShape]} />
            <meshStandardMaterial color="#333333" roughness={0.8} />
        </mesh>
        
        {/* NEW: Detailed Directional Arrows (Head + Shaft) */}
        <group>
            {trackArrows.map((arr, i) => (
                <group key={`arrow-${i}`} position={arr.pos} rotation={[0, arr.angle, 0]}>
                    {/* Arrowhead */}
                    <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 0, 0.4]}>
                        <coneGeometry args={[0.5, 0.8, 3]} />
                        <meshStandardMaterial color="#00ffcc" />
                    </mesh>
                    {/* Arrow Shaft/Tail */}
                    <mesh position={[0, 0, -0.2]}>
                        <boxGeometry args={[0.3, 0.1, 0.8]} />
                        <meshStandardMaterial color="#00ffcc" />
                    </mesh>
                </group>
            ))}
        </group>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
           <extrudeGeometry args={[outerWallShape, { depth: 0.6, bevelEnabled: false }]} />
           <meshStandardMaterial color="#ffffff" />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
           <extrudeGeometry args={[innerWallShape, { depth: 0.6, bevelEnabled: false }]} />
           <meshStandardMaterial color="#ff0000" />
        </mesh>

        {/* Checkered Start/Finish Line */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, (innerRadius + outerRadius) / 2]}>
            <planeGeometry args={[2, outerRadius - innerRadius]} />
            <meshStandardMaterial map={checkerTexture} />
        </mesh>

        {/* 3D LAP TEXT HUD - MOVED HIGHER */}
        <Text
            position={[0, 9, -7]}
            rotation={[-Math.PI / 5, 0, 0]} 
            fontSize={3.5}
            color="#00ffcc"
            font="FiraMono-Regular.ttf"
            anchorX="center"
            anchorY="middle"
        >
            {`LAPS: ${laps}`}
        </Text>

        {/* CELEBRATION PARTICLES */}
        <points ref={particlesRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={particleCount} array={new Float32Array(particleCount * 3)} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial size={0.4} color="#ff00ff" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </points>

        {/* CUTE CAR MODEL */}
        <group ref={carRef} position={[-2, 0.3, (innerRadius + outerRadius) / 2]}>
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.8, 0.4, 1.4]} />
                <meshStandardMaterial color="#ff6b6b" />
            </mesh>
            <mesh position={[0, 0.3, -0.1]}>
                <boxGeometry args={[0.6, 0.3, 0.7]} />
                <meshStandardMaterial color="#4ecdc4" transparent opacity={0.8} />
            </mesh>
            <mesh position={[0.25, 0, 0.71]}>
                <circleGeometry args={[0.1, 16]} />
                <meshBasicMaterial color="#ffe66d" />
            </mesh>
            <mesh position={[-0.25, 0, 0.71]}>
                <circleGeometry args={[0.1, 16]} />
                <meshBasicMaterial color="#ffe66d" />
            </mesh>
            <mesh position={[0.45, -0.1, 0.4]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.15, 0.15, 0.1, 16]} /><meshBasicMaterial color="#111111" /></mesh>
            <mesh position={[-0.45, -0.1, 0.4]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.15, 0.15, 0.1, 16]} /><meshBasicMaterial color="#111111" /></mesh>
            <mesh position={[0.45, -0.1, -0.4]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.15, 0.15, 0.1, 16]} /><meshBasicMaterial color="#111111" /></mesh>
            <mesh position={[-0.45, -0.1, -0.4]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.15, 0.15, 0.1, 16]} /><meshBasicMaterial color="#111111" /></mesh>
        </group>
      </group>

      <group ref={wheelGroupRef} position={[2.5, -1.2, 2]} visible={false}>
          {/* Steering Wheel */}
          <group ref={steeringWheelRef}>
            <mesh>
              <torusGeometry args={[0.8, 0.1, 16, 48]} />
              <meshStandardMaterial color="#333333" />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[1.6, 0.15, 0.05]} />
              <meshStandardMaterial color="#555555" />
            </mesh>
            <mesh position={[0, 0, 0.05]}>
              <cylinderGeometry args={[0.2, 0.2, 0.1, 32]} rotation={[Math.PI / 2, 0, 0]} />
              <meshStandardMaterial color="#ff6b6b" />
            </mesh>
          </group>

          {/* Animated Pedals System */}
          <group position={[1.5, -0.5, 0]}>
            {/* Left Gas Pedal */}
            <group position={[-0.3, 0, 0]}>
               <group ref={gasPedalRef}>
                 <mesh position={[0, -0.3, 0.05]}>
                   <boxGeometry args={[0.2, 0.6, 0.05]} />
                   <meshStandardMaterial color="#00ffcc" />
                 </mesh>
               </group>
               {/* Base Pivot */}
               <mesh position={[0, 0, -0.05]}>
                   <boxGeometry args={[0.1, 0.1, 0.2]} />
                   <meshStandardMaterial color="#555555" />
               </mesh>
            </group>
            
            {/* Right Brake Pedal */}
            <group position={[0.3, 0, 0]}>
               <group ref={brakePedalRef}>
                 <mesh position={[0, -0.2, 0.05]}>
                   <boxGeometry args={[0.4, 0.4, 0.05]} />
                   <meshStandardMaterial color="#ff00ff" />
                 </mesh>
               </group>
               {/* Base Pivot */}
               <mesh position={[0, 0, -0.05]}>
                   <boxGeometry args={[0.1, 0.1, 0.2]} />
                   <meshStandardMaterial color="#555555" />
               </mesh>
            </group>
          </group>
      </group>
      
      <ambientLight ref={ambientLightRef} intensity={0} />
      <directionalLight ref={dirLightRef} position={[5, 10, 5]} intensity={0} castShadow />
    </>
  );
};

export default SpatialDrive;