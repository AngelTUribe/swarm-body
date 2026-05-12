import React, { useEffect, useRef, useState } from 'react';

const PROJECTS = [
  { id: 'p1', title: 'Interactive Portfolio', subtitle: 'WEB.DEV // 01', url: 'https://example.com' },
  { id: 'p2', title: 'Engineering Resume', subtitle: 'DOC.SYS // 02', url: 'resume.pdf' },
  { id: 'p3', title: 'Spatial Game', subtitle: 'SYS.RENDER // 03', url: 'about:blank' },
];

const PortfolioUI = ({ handsPositionRef }) => {
  const cursor1Ref = useRef(null);
  const cursor2Ref = useRef(null);
  
  // Invisible hitboxes for logic
  const topBarRef = useRef(null);
  const terminateZoneRef = useRef(null);

  const [phase, setPhase] = useState('boot'); 
  const [expandedProject, setExpandedProject] = useState(null);
  const [mounted, setMounted] = useState(false);

  const state = useRef({
    draggedId: null,
    isExpanded: false, 
    wasPinching: false, 
    isDraggingZipper: false,
    zipperX: window.innerWidth * 0.35, 
    isDraggingExpanded: false,
    expandedTransform: { x: 0, y: 0 },
    dragOffsetX: 0, dragOffsetY: 0,
    projects: {} 
  });

  useEffect(() => {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const centerX = screenW / 2;
    const centerY = screenH * 0.85; 
    const radius = Math.min(screenW, screenH) * 0.4; 
    const angles = [-35, 0, 35]; 

    PROJECTS.forEach((p, index) => {
      const rad = (angles[index] - 90) * (Math.PI / 180);
      const x = centerX + radius * Math.cos(rad); 
      const y = centerY + radius * Math.sin(rad); 
      state.current.projects[p.id] = { origX: x, origY: y, currX: x, currY: y };
    });
    
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let animationFrameId;

    const updateLoop = () => {
      const hands = handsPositionRef.current?.landmarks || [];
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;

      if (cursor1Ref.current) cursor1Ref.current.style.opacity = hands[0] ? 1 : 0;
      if (cursor2Ref.current) cursor2Ref.current.style.opacity = hands[1] ? 1 : 0;

      let indexX = null; let indexY = null;
      let activePinchX = null; let activePinchY = null;
      let isPinching = false;

      if (hands[0]) {
        const thumb = hands[0][4]; const index = hands[0][8];
        indexX = (1 - index.x) * screenW; indexY = index.y * screenH;
        const thumbX = (1 - thumb.x) * screenW; const thumbY = thumb.y * screenH;

        if (cursor1Ref.current) cursor1Ref.current.style.transform = `translate(${indexX}px, ${indexY}px)`;

        isPinching = Math.hypot(thumbX - indexX, thumbY - indexY) < 40;
        if (cursor1Ref.current) cursor1Ref.current.style.backgroundColor = isPinching ? '#00ffcc' : 'white';

        if (isPinching) { activePinchX = indexX; activePinchY = indexY; }
      }

      // STREAM DATA TO 3D SCENE
      handsPositionRef.current.uiState = {
        phase,
        isExpanded: state.current.isExpanded,
        projects: state.current.projects,
        draggedId: state.current.draggedId,
        screenW, screenH
      };

      // === PHASE 1: BOOT ===
      if (phase === 'boot' || phase === 'transition') {
        const startX = screenW * 0.35; const endX = screenW * 0.65;
        const maskPath = document.getElementById('ar-mask-path');

        if (phase === 'boot') {
          const hoveringZipper = activePinchX > startX - 50 && activePinchX < endX && activePinchY > screenH/2 - 50 && activePinchY < screenH/2 + 50;
          if (isPinching && hoveringZipper) state.current.isDraggingZipper = true;
          if (!isPinching) state.current.isDraggingZipper = false;
          if (state.current.isDraggingZipper) state.current.zipperX = Math.max(startX, Math.min(activePinchX, screenW * 0.7)); 
        }

        const pullProgress = Math.max(0, (state.current.zipperX - startX) / (endX - startX));
        handsPositionRef.current.zipperState = { x: state.current.zipperX, progress: pullProgress, phase };

        if (maskPath) {
          const zx = state.current.zipperX; const gap = pullProgress * (screenH * 0.6); 
          maskPath.setAttribute('d', `M 0 0 L ${screenW} 0 L ${screenW} ${screenH} L 0 ${screenH} Z M 0 ${screenH/2 - gap} Q ${zx/2} ${screenH/2 - gap} ${zx} ${screenH/2} Q ${zx/2} ${screenH/2 + gap} 0 ${screenH/2 + gap} Z`);
        }

        const zipperEl = document.getElementById('zipper-handle');
        if (zipperEl) zipperEl.style.transform = `translate(${state.current.zipperX}px, -50%)`;

        if (state.current.zipperX > endX && phase === 'boot') {
          setPhase('transition'); if (maskPath) maskPath.style.opacity = '0'; 
          setTimeout(() => setPhase('main'), 1200); 
        }
        state.current.wasPinching = isPinching;
        animationFrameId = requestAnimationFrame(updateLoop); return; 
      }

      handsPositionRef.current.zipperState = { phase: 'main' };

      // === NEW: PINCH-FREE EXPANDED WINDOW DRAGGING ===
      if (state.current.isExpanded) {
        const topEl = topBarRef.current;
        const termEl = terminateZoneRef.current;

        if (topEl && termEl && indexX !== null) {
          const topRect = topEl.getBoundingClientRect();
          const termRect = termEl.getBoundingClientRect();

          // Latch on purely via Hover (No pinch needed!)
          const hoveringTop = indexX > topRect.left && indexX < topRect.right && indexY > topRect.top && indexY < topRect.bottom;

          if (hoveringTop && !state.current.isDraggingExpanded) {
            state.current.isDraggingExpanded = true;
            state.current.dragOffsetX = indexX - state.current.expandedTransform.x;
            state.current.dragOffsetY = indexY - state.current.expandedTransform.y;
            topEl.style.backgroundColor = 'rgba(0, 255, 204, 0.3)'; // Visual feedback
          }

          if (state.current.isDraggingExpanded) {
            // Move window with finger
            state.current.expandedTransform.x = indexX - state.current.dragOffsetX;
            state.current.expandedTransform.y = indexY - state.current.dragOffsetY;

            // Check if dragged into the Terminate Zone
            if (indexX > termRect.left && indexX < termRect.right && indexY > termRect.top && indexY < termRect.bottom) {
              // TERMINATE INSTANTLY
              setExpandedProject(null);
              state.current.isExpanded = false;
              state.current.isDraggingExpanded = false;
              state.current.expandedTransform = { x: 0, y: 0 };
            }

            // Drop if hand leaves screen
            if (!hands[0]) {
              state.current.isDraggingExpanded = false;
              state.current.expandedTransform = { x: 0, y: 0 };
            }
          } else {
             topEl.style.backgroundColor = 'rgba(0, 255, 204, 0.05)';
          }
        }
        state.current.wasPinching = isPinching;
        animationFrameId = requestAnimationFrame(updateLoop); return; 
      }

      // === 3D CUBE DRAG LOGIC ===
      const dropCenterX = screenW / 2;
      const dropCenterY = screenH * 0.85; // Matches 3D hole position

      if (!state.current.draggedId && isPinching && activePinchX !== null) {
        for (let p of PROJECTS) {
          const pState = state.current.projects[p.id];
          // 80px hitbox radius around the cube's screen position
          if (Math.hypot(activePinchX - pState.currX, activePinchY - pState.currY) < 80) {
            state.current.draggedId = p.id; break; 
          }
        }
      }

      if (state.current.draggedId) {
        const pid = state.current.draggedId;
        const pState = state.current.projects[pid];

        if (isPinching) {
          // Magnetic Pull to the 3D hole
          if (Math.hypot(activePinchX - dropCenterX, activePinchY - dropCenterY) < 150) {
            pState.currX = dropCenterX; pState.currY = dropCenterY;
          } else {
            pState.currX = activePinchX; pState.currY = activePinchY;
          }
        } else {
          // Dropped!
          state.current.draggedId = null;
          if (Math.hypot(pState.currX - dropCenterX, pState.currY - dropCenterY) < 100) {
            setExpandedProject(PROJECTS.find(p => p.id === pid));
            state.current.isExpanded = true;
          }
          pState.currX = pState.origX; pState.currY = pState.origY; 
        }
      }

      state.current.wasPinching = isPinching;
      animationFrameId = requestAnimationFrame(updateLoop);
    };

    updateLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mounted, phase]); 

  if (!mounted) return null;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 10 }}>
      
      {/* 1. BOOT SCREEN UI */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: phase === 'boot' ? 1 : 0, transition: 'opacity 0.5s', zIndex: 50 }}>
        <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: '550px', padding: '30px', textAlign: 'center', backgroundColor: 'rgba(5, 10, 15, 0.7)', backdropFilter: 'blur(15px)', border: '1px solid rgba(0, 255, 204, 0.4)', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,255,204,0.1)' }}>
          <h2 style={{ color: '#fff', fontFamily: 'monospace', fontSize: '1.6rem', letterSpacing: '5px', margin: '0 0 15px 0' }}>SPATIAL HAND ENVIRONMENT</h2>
          <p style={{ color: '#00ffcc', fontFamily: 'sans-serif', fontSize: '1.1rem', lineHeight: '1.6', margin: 0, opacity: 0.9 }}>
            Hold your hand up. Bring your index finger and thumb together to <strong>pinch</strong> the zipper below, then physically pull it to the right.
          </p>
        </div>
        <div style={{ position: 'absolute', top: '50%', left: '35%', width: '30%', height: '4px', borderBottom: '2px dotted rgba(0, 255, 204, 0.5)', transform: 'translateY(-50%)' }} />
        <div id="zipper-handle" style={{ position: 'absolute', top: '50%', left: 0, width: '65px', height: '24px', display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', transform: 'translate(35vw, -50%)', marginLeft: '-32px' }}>
          <div style={{ width: '28px', height: '24px', backgroundColor: '#e0e0e0', borderRadius: '4px 10px 10px 4px', boxShadow: 'inset -4px 0 0 #fff, inset 4px 0 0 #999, 0 0 20px rgba(0,255,204,0.9)', zIndex: 2 }} />
          <div style={{ width: '40px', height: '18px', backgroundColor: 'rgba(5, 15, 25, 0.9)', border: '2px solid #00ffcc', borderRadius: '10px 0 0 10px', marginRight: '-6px', zIndex: 1 }} />
        </div>
      </div>

      {/* 2. EXPANDED WINDOW (Pinch-Free Drag) */}
      {expandedProject && (
        <div ref={terminateZoneRef} style={{
          position: 'absolute', bottom: '5%', left: '50%', transform: 'translateX(-50%)', width: '250px', height: '100px',
          border: '2px dashed #ff0055', borderRadius: '12px', backgroundColor: 'rgba(255, 0, 85, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
          color: '#ff0055', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.4rem', letterSpacing: '4px',
          boxShadow: '0 0 30px rgba(255,0,85,0.4), inset 0 0 20px rgba(255,0,85,0.2)'
        }}>
          [ INCINERATOR ]
        </div>
      )}

      {expandedProject && (
        <div style={{
          position: 'absolute', top: '10%', left: '10%', width: '80%', height: '75%', backgroundColor: 'rgba(5, 10, 15, 0.85)', borderRadius: '16px',
          border: '1px solid rgba(0, 255, 204, 0.5)', boxShadow: '0 0 80px rgba(0, 255, 204, 0.2)', backdropFilter: 'blur(20px)', zIndex: 300, display: 'flex', flexDirection: 'column',
          transform: `translate(${state.current.expandedTransform.x}px, ${state.current.expandedTransform.y}px)`,
          transition: state.current.isDraggingExpanded ? 'none' : 'transform 0.3s ease-out'
        }}>
          {/* LATCH ZONE - Hover to grab! */}
          <div ref={topBarRef} style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 25px', 
            borderBottom: '1px solid rgba(0, 255, 204, 0.2)', backgroundColor: 'rgba(0, 255, 204, 0.05)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', transition: 'background-color 0.2s'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: state.current.isDraggingExpanded ? '#ff0055' : '#00ffcc', borderRadius: '50%', boxShadow: `0 0 15px ${state.current.isDraggingExpanded ? '#ff0055' : '#00ffcc'}` }} />
              <span style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: '1.4rem', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>{expandedProject.title}</span>
            </div>
            <div style={{ color: state.current.isDraggingExpanded ? '#ff0055' : '#00ffcc', fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold' }}>
              {state.current.isDraggingExpanded ? '>>> DRAG TO INCINERATOR <<<' : '::: HOVER HERE TO GRAB :::'}
            </div>
          </div>
          <div style={{ flex: 1, padding: '15px', pointerEvents: 'auto' }}>
            <iframe src={expandedProject.url} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', backgroundColor: '#fff' }} title={expandedProject.title} />
          </div>
        </div>
      )}

      {/* Hand Trackers */}
      <div ref={cursor1Ref} style={{ ...cursorStyle, zIndex: 999 }} />
      <div ref={cursor2Ref} style={{ ...cursorStyle, zIndex: 999 }} />
    </div>
  );
};

const cursorStyle = { position: 'absolute', top: 0, left: 0, width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', transformOrigin: 'center', marginLeft: '-10px', marginTop: '-10px', transition: 'background-color 0.1s', boxShadow: '0 0 15px rgba(0, 255, 204, 1)' };

export default PortfolioUI;