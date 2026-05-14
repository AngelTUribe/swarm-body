import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SpatialDrive = ({ handsPositionRef }) => {
  const gameGroupRef = useRef();
  const wheelGroupRef = useRef();
  const carRef = useRef();
  const steeringWheelRef = useRef();
  
  const ambientLightRef = useRef();
  const dirLightRef = useRef();
  
  const activeHandMemory = useRef({ position: null, locked: false, lostFrames: 0 });
  const speedRef = useRef(0);
  const angleRef = useRef(0);
  const steerInputRef = useRef(0); 

  // NASCAR Oval Track Dimensions
  const straightLength = 6;
  const innerRadius = 4;
  const outerRadius = 9;

  // Procedural Checkered Flag Texture
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

  // Oval Track Shapes
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
    if (ambientLightRef.current) ambientLightRef.current.intensity = isActive ? 0.6 : 0;
    if (dirLightRef.current) dirLightRef.current.intensity = isActive ? 1.5 : 0;

    if (!isActive) return;

    const hands = handsPositionRef.current?.landmarks || [];
    const screenW = window.innerWidth;

    // === STRICT RIGHT-HAND LOCK ===
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

    if (!activeHand) {
      activeHandMemory.current.lostFrames++;
      if (activeHandMemory.current.lostFrames > 15) {
        activeHandMemory.current.locked = false;
        activeHandMemory.current.position = null;
      }
    } else {
      activeHandMemory.current.position = activeHand[8];
      
      let acceleration = 0;
      if (isOpenPalm(activeHand)) acceleration = 0.007; 
      else if (isFist(activeHand)) acceleration = -0.005; 

      const ix = (1 - activeHand[8].x) * screenW;
      
      // Steering locked to right hemisphere
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

    if (steeringWheelRef.current) {
        const targetRotation = -steerInputRef.current * Math.PI * 0.6;
        steeringWheelRef.current.rotation.z += (targetRotation - steeringWheelRef.current.rotation.z) * 0.15;
    }

    if (carRef.current) {
      carRef.current.rotation.y = angleRef.current;
      
      const nextX = carRef.current.position.x + Math.sin(angleRef.current) * speedRef.current;
      const nextZ = carRef.current.position.z + Math.cos(angleRef.current) * speedRef.current;

      const clampedX = Math.max(-straightLength, Math.min(straightLength, nextX));
      const distFromCenter = Math.hypot(nextX - clampedX, nextZ);

      if (distFromCenter < innerRadius + 0.4) {
        const bounceAngle = Math.atan2(nextZ, nextX - clampedX);
        carRef.current.position.x = clampedX + Math.cos(bounceAngle) * (innerRadius + 0.4);
        carRef.current.position.z = Math.sin(bounceAngle) * (innerRadius + 0.4);
        speedRef.current *= 0.6; 
      } else if (distFromCenter > outerRadius - 0.4) {
        const bounceAngle = Math.atan2(nextZ, nextX - clampedX);
        carRef.current.position.x = clampedX + Math.cos(bounceAngle) * (outerRadius - 0.4);
        carRef.current.position.z = Math.sin(bounceAngle) * (outerRadius - 0.4);
        speedRef.current *= 0.6; 
      } else {
        carRef.current.position.x = nextX;
        carRef.current.position.z = nextZ;
      }
    }
  });

  return (
    <>
      {/* THE FIX: 
        1. Reduced scale to 0.3 so it fits beautifully on screen like a toy track.
        2. Shifted position slightly right (+1 on X axis) and set a nice top-down tilt.
      */}
      <group ref={gameGroupRef} position={[1, -0.5, -6]} scale={0.3} rotation={[-Math.PI / 3, 0, 0]} visible={false}>
        
        {/* Outer Environment / Grass */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
            <circleGeometry args={[25, 64]} />
            <meshBasicMaterial color="#7ec850" />
        </mesh>

        {/* Inner Grass */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
            <shapeGeometry args={[grassShape]} />
            <meshStandardMaterial color="#68ab40" />
        </mesh>

        {/* Asphalt Oval Track */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
            <shapeGeometry args={[trackShape]} />
            <meshStandardMaterial color="#333333" />
        </mesh>

        {/* Outer Wall */}
        <mesh position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
           <capsuleGeometry args={[outerRadius + 0.2, straightLength * 2, 8, 32]} />
           <meshStandardMaterial color="#ffffff" />
        </mesh>
        {/* Inner Wall */}
        <mesh position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
           <capsuleGeometry args={[innerRadius - 0.2, straightLength * 2, 8, 32]} />
           <meshStandardMaterial color="#ff0000" />
        </mesh>

        {/* Checkered Start/Finish Line */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, (innerRadius + outerRadius) / 2]}>
            <planeGeometry args={[2, outerRadius - innerRadius]} />
            <meshStandardMaterial map={checkerTexture} />
        </mesh>

        {/* CUTE CAR MODEL */}
        <group ref={carRef} position={[0, 0.3, (innerRadius + outerRadius) / 2]} rotation={[0, Math.PI / 2, 0]}>
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
            {/* Tires */}
            <mesh position={[0.45, -0.1, 0.4]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.15, 0.15, 0.1, 16]} /><meshBasicMaterial color="#111111" /></mesh>
            <mesh position={[-0.45, -0.1, 0.4]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.15, 0.15, 0.1, 16]} /><meshBasicMaterial color="#111111" /></mesh>
            <mesh position={[0.45, -0.1, -0.4]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.15, 0.15, 0.1, 16]} /><meshBasicMaterial color="#111111" /></mesh>
            <mesh position={[-0.45, -0.1, -0.4]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.15, 0.15, 0.1, 16]} /><meshBasicMaterial color="#111111" /></mesh>
        </group>
      </group>

      {/* THE FIX:
        Moved the wheel to the positive X axis (right side of the screen)
      */}
      <group ref={wheelGroupRef} position={[2.5, -1.2, 2]} visible={false}>
          <group ref={steeringWheelRef}>
            <mesh>
              <torusGeometry args={[0.8, 0.1, 16, 48]} />
              <meshBasicMaterial color="#333333" />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[1.6, 0.15, 0.05]} />
              <meshBasicMaterial color="#555555" />
            </mesh>
            <mesh position={[0, 0, 0.05]}>
              <cylinderGeometry args={[0.2, 0.2, 0.1, 32]} rotation={[Math.PI / 2, 0, 0]} />
              <meshBasicMaterial color="#ff6b6b" />
            </mesh>
          </group>
      </group>
      
      <ambientLight ref={ambientLightRef} intensity={0} />
      <directionalLight ref={dirLightRef} position={[10, 20, 10]} intensity={0} />
    </>
  );
};

export default SpatialDrive;