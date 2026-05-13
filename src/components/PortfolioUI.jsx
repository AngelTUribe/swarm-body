import React, { useEffect, useRef, useState } from 'react';
import VoxelBuilder from './VoxelBuilder';

const PROJECTS = [
  { id: 'p1', title: 'Interactive Portfolio', subtitle: 'WEB.DEV // 01', url: 'https://angelturibe.github.io/my-portfolio/' },
  { id: 'p2', title: 'Engineering Resume', subtitle: 'DOC.SYS // 02', url: 'resume.pdf' },
  { id: 'p3', title: 'Spatial Game', subtitle: 'SYS.RENDER // 03', url: 'about:blank' },
];

const PortfolioUI = ({ handsPositionRef }) => {
  const cursor1Ref = useRef(null);
  const cursor2Ref = useRef(null);

  const [phase, setPhase] = useState('boot'); 
  const [expandedProject, setExpandedProject] = useState(null);
  const [mounted, setMounted] = useState(false);

  const state = useRef({
    draggedId: null,
    activeId: null, 
    layout: 'central', 
    hasLeftOrigin: false, 
    activeHandId: null, // NEW: Locks onto the hand that grabbed the object
    zipperX: window.innerWidth * 0.35, 
    isDraggingZipper: false,
    holeCurrX: window.innerWidth / 2, 
    holeCurrY: window.innerHeight * 0.65,
    holeCentral: { x: 0, y: 0 },
    holeSplit: { x: 0, y: 0 },
    projects: {} 
  });

  useEffect(() => {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    
    const centerY = screenH * 0.65; 
    const radius = Math.min(screenW, screenH) * 0.4; 
    const angles = [-35, 0, 35]; 

    state.current.holeCentral = { x: screenW / 2, y: centerY };
    state.current.holeSplit = { x: screenW * 0.85, y: screenH * 0.5 }; 
    state.current.holeCurrX = screenW / 2;
    state.current.holeCurrY = centerY;

    PROJECTS.forEach((p, index) => {
      const rad = (angles[index] - 90) * (Math.PI / 180);
      const cx = (screenW / 2) + radius * Math.cos(rad); 
      const cy = centerY + radius * Math.sin(rad); 
      
      const sx = screenW * 0.15;
      const sy = screenH * 0.3 + (index * screenH * 0.2); 

      state.current.projects[p.id] = { 
        central: { x: cx, y: cy }, 
        split: { x: sx, y: sy }, 
        currX: cx, currY: cy,
        slotCurrX: cx, slotCurrY: cy 
      };
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

      // 1. Process Hands and assign an ID
      const processHand = (hand, cursorRef, handId) => {
        if (!hand) return null;
        const thumb = hand[4]; const index = hand[8];
        const ix = (1 - index.x) * screenW; const iy = index.y * screenH;
        const tx = (1 - thumb.x) * screenW; const ty = thumb.y * screenH;
        const pinch = Math.hypot(tx - ix, ty - iy) < 45;
        
        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate(${ix}px, ${iy}px)`;
          cursorRef.current.style.backgroundColor = pinch ? '#00ffcc' : 'white';
        }
        return { ix, iy, pinch, id: handId };
      };

      const hand1 = processHand(hands[0], cursor1Ref, 1);
      const hand2 = processHand(hands[1], cursor2Ref, 2);

      const isDragging = state.current.draggedId || state.current.isDraggingZipper;

      // 2. Hand Lock Visuals (Hide the inactive cursor)
      let op1 = hands[0] ? 1 : 0;
      let op2 = hands[1] ? 1 : 0;
      
      if (isDragging && state.current.activeHandId) {
        if (state.current.activeHandId === 1) op2 = 0;
        if (state.current.activeHandId === 2) op1 = 0;
      }

      if (cursor1Ref.current) cursor1Ref.current.style.opacity = op1;
      if (cursor2Ref.current) cursor2Ref.current.style.opacity = op2;

      // 3. Hand Lock Logic (Ignore the inactive hand's coordinates)
      let activeHand = null;
      if (isDragging && state.current.activeHandId) {
        activeHand = (state.current.activeHandId === 1) ? hand1 : hand2;
      } else {
        if (hand1?.pinch) activeHand = hand1;
        else if (hand2?.pinch) activeHand = hand2;
        else activeHand = hand1 || hand2;
      }

      let indexX = null; let indexY = null; let isPinching = false;
      if (activeHand) {
        indexX = activeHand.ix; indexY = activeHand.iy; isPinching = activeHand.pinch;
      }

      // === BOOT PHASE ===
      if (phase === 'boot' || phase === 'transition') {
        const startX = screenW * 0.35; const endX = screenW * 0.65;
        const maskPath = document.getElementById('ar-mask-path');

        if (phase === 'boot') {
          const hoveringZipper = indexX > startX - 50 && indexX < endX + 50 && indexY > screenH/2 - 100 && indexY < screenH/2 + 100;
          
          if (isPinching && hoveringZipper && !state.current.isDraggingZipper) {
            state.current.isDraggingZipper = true;
            state.current.activeHandId = activeHand.id; // Lock onto the hand pulling the zipper!
          }
          if (!isPinching) {
            state.current.isDraggingZipper = false;
            if (!state.current.draggedId) state.current.activeHandId = null; // Release the lock
          }
          if (state.current.isDraggingZipper) state.current.zipperX = Math.max(startX, Math.min(indexX, screenW * 0.7)); 
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
        animationFrameId = requestAnimationFrame(updateLoop); return; 
      }

      handsPositionRef.current.zipperState = { phase: 'main' };

      // === UNIFIED PHYSICS GLIDE ===
      let isSnapped = false; 
      const targetHole = state.current.layout === 'split' ? state.current.holeSplit : state.current.holeCentral;
      state.current.holeCurrX += (targetHole.x - state.current.holeCurrX) * 0.1;
      state.current.holeCurrY += (targetHole.y - state.current.holeCurrY) * 0.1;

      const execLabel = document.getElementById('execute-label');
      if (execLabel) {
        execLabel.style.left = `${state.current.holeCurrX}px`;
        execLabel.style.top = `${state.current.holeCurrY + 70}px`;
        execLabel.style.opacity = state.current.layout === 'split' ? '0' : '1';
      }

      PROJECTS.forEach(p => {
        const pState = state.current.projects[p.id];
        const targetSlot = state.current.layout === 'split' ? pState.split : pState.central;

        pState.slotCurrX += (targetSlot.x - pState.slotCurrX) * 0.1;
        pState.slotCurrY += (targetSlot.y - pState.slotCurrY) * 0.1;

        const projectLabel = document.getElementById(`label-${p.id}`);
        if (projectLabel) {
          projectLabel.style.left = `${pState.slotCurrX}px`;
          projectLabel.style.top = `${pState.slotCurrY - 80}px`;
        }

        if (state.current.draggedId !== p.id) {
          let targetX = (state.current.activeId === p.id) ? targetHole.x : targetSlot.x;
          let targetY = (state.current.activeId === p.id) ? targetHole.y : targetSlot.y;
          
          pState.currX += (targetX - pState.currX) * 0.1;
          pState.currY += (targetY - pState.currY) * 0.1;
        }
      });

      // === PINCH DETECTION (Initial Grab) ===
      if (!state.current.draggedId && isPinching && indexX !== null) {
        for (let p of PROJECTS) {
          const pState = state.current.projects[p.id];
          if (Math.hypot(indexX - pState.currX, indexY - pState.currY) < 80) {
            state.current.draggedId = p.id;
            state.current.hasLeftOrigin = false; 
            state.current.activeHandId = activeHand.id; // Lock onto the hand that grabbed the cube!
            break; 
          }
        }
      }

      // === STICKY DRAG & MAGNETIC SNAP LOGIC ===
      if (state.current.draggedId && indexX !== null) {
        const pid = state.current.draggedId;
        const pState = state.current.projects[pid];
        
        const activeHole = state.current.layout === 'split' ? state.current.holeSplit : state.current.holeCentral;
        const activeSlot = state.current.layout === 'split' ? pState.split : pState.central; 

        // Always stick to the active locked finger
        pState.currX = indexX;
        pState.currY = indexY;

        const distToHole = Math.hypot(indexX - activeHole.x, indexY - activeHole.y);
        const distToSlot = Math.hypot(indexX - activeSlot.x, indexY - activeSlot.y);
        const dropThreshold = 120; 

        if (!state.current.hasLeftOrigin) {
          if (state.current.layout === 'central' && distToSlot > 150) state.current.hasLeftOrigin = true;
          if (state.current.layout === 'split' && distToHole > 150) state.current.hasLeftOrigin = true;
        }

        if (state.current.hasLeftOrigin) {
          if (state.current.layout === 'central') {
            if (distToHole < dropThreshold) {
              isSnapped = true; pState.currX = activeHole.x; pState.currY = activeHole.y; 
              state.current.draggedId = null; state.current.activeHandId = null; // Release the lock
              state.current.layout = 'split'; state.current.activeId = pid;
              setTimeout(() => setExpandedProject(PROJECTS.find(p => p.id === pid)), 600);
            } else if (distToSlot < dropThreshold) {
              isSnapped = true; pState.currX = activeSlot.x; pState.currY = activeSlot.y; 
              state.current.draggedId = null; state.current.activeHandId = null; // Release the lock
            }
          } 
          else if (state.current.layout === 'split') {
            if (distToSlot < dropThreshold) {
              isSnapped = true; pState.currX = activeSlot.x; pState.currY = activeSlot.y; 
              state.current.draggedId = null; state.current.activeHandId = null; // Release the lock
              setExpandedProject(null); state.current.layout = 'central'; state.current.activeId = null;
            } else if (distToHole < dropThreshold) {
               isSnapped = true; pState.currX = activeHole.x; pState.currY = activeHole.y; 
               state.current.draggedId = null; state.current.activeHandId = null; // Release the lock
            }
          }
        }
      }

      // STREAM DATA TO 3D SCENE
      handsPositionRef.current.uiState = {
        phase, layout: state.current.layout, projects: state.current.projects,
        holeCurrX: state.current.holeCurrX, holeCurrY: state.current.holeCurrY,
        draggedId: state.current.draggedId, activeId: state.current.activeId, isSnapped, screenW, screenH
      };

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    updateLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mounted, phase, expandedProject]); 

  if (!mounted) return null;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 2000 }}>
      {/* BOOT SCREEN */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: phase === 'boot' ? 1 : 0, transition: 'opacity 0.5s', zIndex: 50 }}>
        <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: '500px', padding: '20px', textAlign: 'center', backgroundColor: 'rgba(5, 10, 15, 0.8)', border: '1px solid #00ffcc', borderRadius: '12px' }}>
          <h2 style={{ color: '#fff', fontFamily: 'monospace', letterSpacing: '4px' }}>SPATIAL ENVIRONMENT</h2>
          <p style={{ color: '#00ffcc' }}>Pinch and pull the zipper to begin.</p>
        </div>
        <div style={{ position: 'absolute', top: '50%', left: '35%', width: '30%', height: '2px', borderBottom: '2px dotted #00ffcc', transform: 'translateY(-50%)', opacity: 0.5 }} />
        <div id="zipper-handle" style={{ position: 'absolute', top: '50%', left: 0, width: '60px', height: '20px', display: 'flex', alignItems: 'center', transform: 'translate(35vw, -50%)', marginLeft: '-30px' }}>
          <div style={{ width: '30px', height: '24px', backgroundColor: '#fff', borderRadius: '4px', boxShadow: '0 0 15px #00ffcc' }} />
          <div style={{ width: '30px', height: '10px', backgroundColor: 'rgba(0,255,204,0.3)', border: '1px solid #00ffcc' }} />
        </div>
      </div>

      {/* DYNAMIC LABELS */}
      {phase === 'main' && PROJECTS.map(p => {
        const pState = state.current.projects[p.id];
        if (pState.slotCurrX === undefined) return null;
        return (
          <div key={p.id} id={`label-${p.id}`} style={{ 
            position: 'absolute', left: pState.slotCurrX, top: pState.slotCurrY - 80, 
            transform: 'translateX(-50%)', color: '#00ffcc', fontFamily: 'monospace',
          }}>
            <strong>{p.title}</strong>
          </div>
        )
      })}

      {/* DYNAMIC EXECUTE LABEL */}
      {phase === 'main' && (
        <div id="execute-label" style={{ 
          position: 'absolute', left: state.current.holeCurrX, top: state.current.holeCurrY + 70, 
          transform: 'translateX(-50%)', color: '#00ffcc', fontFamily: 'monospace', fontWeight: 'bold',
          transition: 'opacity 0.3s'
        }}>
          DRAG HERE TO INITIALIZE
        </div>
      )}

     {/* 2. EXPANDED WINDOW (Hover top bar to shape-shift!) */}
      {expandedProject && (
        <div style={{
          position: 'absolute', top: '10%', left: '10%', width: '80%', height: '75%', 
          // If p3 is active, the background is totally transparent so the 3D scene shines through!
          backgroundColor: expandedProject.id === 'p3' ? 'transparent' : 'rgba(5, 10, 15, 0.85)', 
          borderRadius: '16px',
          border: expandedProject.id === 'p3' ? 'none' : '1px solid rgba(0, 255, 204, 0.5)', 
          boxShadow: expandedProject.id === 'p3' ? 'none' : '0 0 80px rgba(0, 255, 204, 0.2)', 
          backdropFilter: expandedProject.id === 'p3' ? 'none' : 'blur(20px)', 
          zIndex: 300, display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          
          {/* TOP BAR: Hover here to collapse into a cube */}
          <div ref={topBarRef} style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 25px', 
            borderBottom: expandedProject.id === 'p3' ? 'none' : '1px solid rgba(0, 255, 204, 0.2)', 
            backgroundColor: expandedProject.id === 'p3' ? 'rgba(255, 0, 255, 0.15)' : 'rgba(0, 255, 204, 0.05)', 
            border: expandedProject.id === 'p3' ? '1px solid #ff00ff' : 'none',
            borderRadius: expandedProject.id === 'p3' ? '16px' : '16px 16px 0 0',
            backdropFilter: 'blur(10px)', pointerEvents: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ 
                width: '12px', height: '12px', borderRadius: '50%', 
                backgroundColor: expandedProject.id === 'p3' ? '#ff00ff' : '#00ffcc', 
                boxShadow: `0 0 15px ${expandedProject.id === 'p3' ? '#ff00ff' : '#00ffcc'}` 
              }} />
              <span style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: '1.4rem', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>
                {expandedProject.id === 'p3' ? 'NEON BUILDER' : expandedProject.title}
              </span>
            </div>
            <div style={{ color: expandedProject.id === 'p3' ? '#ff00ff' : '#00ffcc', fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold' }}>
              ::: HOVER FINGER HERE TO CLOSE :::
            </div>
          </div>

          {/* STANDARD IFRAME (Only shows if NOT the neon builder) */}
          {expandedProject.id !== 'p3' && (
            <div style={{ flex: 1, padding: '15px', pointerEvents: 'auto' }}>
              <iframe src={expandedProject.url} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', backgroundColor: '#fff' }} title={expandedProject.title} />
            </div>
          )}

          {/* FLOATING INSTRUCTIONS (Only shows during neon builder) */}
          {expandedProject.id === 'p3' && (
            <div style={{ color: '#ff00ff', fontFamily: 'monospace', textAlign: 'center', marginTop: '30px', textShadow: '0 0 10px #ff00ff' }}>
              <h2 style={{ letterSpacing: '3px' }}>[ SPATIAL HANDS ACTIVE ]</h2>
              <p style={{ fontSize: '1.2rem' }}><b>PINCH:</b> Build Block</p>
              <p style={{ fontSize: '1.2rem' }}><b>OPEN PALM:</b> Rotate World</p>
              <p style={{ fontSize: '1.2rem' }}><b>CLOSED FIST:</b> Hover to Erase</p>
            </div>
          )}
        </div>
      )}

      {/* CURSORS */}
      <div ref={cursor1Ref} style={{ ...cursorStyle, zIndex: 1000 }} />
      <div ref={cursor2Ref} style={{ ...cursorStyle, zIndex: 1000 }} />
    </div>
  );
};

const cursorStyle = { position: 'absolute', width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', transformOrigin: 'center', marginLeft: '-10px', marginTop: '-10px', boxShadow: '0 0 15px #00ffcc' };

export default PortfolioUI;