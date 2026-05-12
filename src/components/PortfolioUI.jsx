import React, { useEffect, useRef, useState } from 'react';

const PROJECTS = [
  { id: 'p1', title: 'Interactive Portfolio', subtitle: 'WEB.DEV // 01', url: 'https://example.com' },
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
    activeId: null, // Tracks which cube is currently running in the hole
    layout: 'central', // 'central' or 'split'
    zipperX: window.innerWidth * 0.35, 
    isDraggingZipper: false,
    readyToExecute: false,
    holeCentral: { x: 0, y: 0 },
    holeSplit: { x: 0, y: 0 },
    projects: {} 
  });

  useEffect(() => {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    
    // 1. Move everything UP (0.65 instead of 0.85)
    const centerY = screenH * 0.65; 
    const radius = Math.min(screenW, screenH) * 0.4; 
    const angles = [-35, 0, 35]; 

    // Target positions for the Execute Hole
    state.current.holeCentral = { x: screenW / 2, y: centerY };
    state.current.holeSplit = { x: screenW * 0.85, y: screenH * 0.5 }; // Right side

    PROJECTS.forEach((p, index) => {
      // Target positions for Central Arc
      const rad = (angles[index] - 90) * (Math.PI / 180);
      const cx = (screenW / 2) + radius * Math.cos(rad); 
      const cy = centerY + radius * Math.sin(rad); 
      
      // Target positions for Vertical Left Side
      const sx = screenW * 0.15;
      const sy = screenH * 0.3 + (index * screenH * 0.2); // Stack vertically

      state.current.projects[p.id] = { 
        central: { x: cx, y: cy }, 
        split: { x: sx, y: sy }, 
        currX: cx, currY: cy,
        slotPos: { x: cx, y: cy }
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

      if (cursor1Ref.current) cursor1Ref.current.style.opacity = hands[0] ? 1 : 0;
      if (cursor2Ref.current) cursor2Ref.current.style.opacity = hands[1] ? 1 : 0;

      let indexX = null; let indexY = null;
      let isPinching = false;
      let isSnapped = false; 

      const processHand = (hand, cursorRef) => {
        if (!hand) return null;
        const thumb = hand[4]; const index = hand[8];
        const ix = (1 - index.x) * screenW; const iy = index.y * screenH;
        const tx = (1 - thumb.x) * screenW; const ty = thumb.y * screenH;
        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate(${ix}px, ${iy}px)`;
          const pinch = Math.hypot(tx - ix, ty - iy) < 45;
          cursorRef.current.style.backgroundColor = pinch ? '#00ffcc' : 'white';
          return { ix, iy, pinch };
        }
        return null;
      };

      const hand1 = processHand(hands[0], cursor1Ref);
      const hand2 = processHand(hands[1], cursor2Ref);
      let activeHand = (hand1?.pinch) ? hand1 : (hand2?.pinch ? hand2 : (hand1 || hand2));
      
      if (activeHand) {
        indexX = activeHand.ix; indexY = activeHand.iy;
        isPinching = activeHand.pinch;
      }

      if (phase === 'boot' || phase === 'transition') {
        const startX = screenW * 0.35; const endX = screenW * 0.65;
        const maskPath = document.getElementById('ar-mask-path');

        if (phase === 'boot') {
          const hoveringZipper = indexX > startX - 50 && indexX < endX + 50 && indexY > screenH/2 - 100 && indexY < screenH/2 + 100;
          if (isPinching && hoveringZipper) state.current.isDraggingZipper = true;
          if (!isPinching) state.current.isDraggingZipper = false;
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

      // === PHYSICS GLIDE (Smoothly interpolate objects to their targets) ===
      PROJECTS.forEach(p => {
        const pState = state.current.projects[p.id];
        
        // 1. Where should this specific empty slot outline be right now?
        pState.slotPos = state.current.layout === 'split' ? pState.split : pState.central;

        // 2. Where should the physical cube be right now? (If it's NOT being dragged)
        if (state.current.draggedId !== p.id) {
          let targetX, targetY;
          if (state.current.activeId === p.id) {
            // This cube is active! It goes in the hole.
            targetX = state.current.layout === 'split' ? state.current.holeSplit.x : state.current.holeCentral.x;
            targetY = state.current.layout === 'split' ? state.current.holeSplit.y : state.current.holeCentral.y;
          } else {
            // This cube is inactive! It goes in its slot.
            targetX = pState.slotPos.x;
            targetY = pState.slotPos.y;
          }
          // Smooth Lerp for 2D position (Which passes perfectly into 3D)
          pState.currX += (targetX - pState.currX) * 0.1;
          pState.currY += (targetY - pState.currY) * 0.1;
        }
      });

      // === PINCH DETECTION (Grab from ANYWHERE) ===
      if (!state.current.draggedId && isPinching && indexX !== null) {
        for (let p of PROJECTS) {
          const pState = state.current.projects[p.id];
          if (Math.hypot(indexX - pState.currX, indexY - pState.currY) < 80) {
            state.current.draggedId = p.id;
            state.current.readyToExecute = false;
            break; 
          }
        }
      }

      // === DRAG & SNAP LOGIC ===
      if (state.current.draggedId) {
        const pid = state.current.draggedId;
        const pState = state.current.projects[pid];
        
        // Determine targets based on current layout
        const activeHole = state.current.layout === 'split' ? state.current.holeSplit : state.current.holeCentral;
        const activeSlot = pState.slotPos; // This is the cube's designated home

        if (state.current.layout === 'central') {
          // OPENING A WINDOW
          const distToHole = Math.hypot(indexX - activeHole.x, indexY - activeHole.y);
          if (isPinching) {
            if (distToHole < 150) {
              isSnapped = true; pState.currX = activeHole.x; pState.currY = activeHole.y; state.current.readyToExecute = true; 
            } else {
              pState.currX = indexX; pState.currY = indexY; if (distToHole > 250) state.current.readyToExecute = false; 
            }
          } else {
            state.current.draggedId = null;
            if (state.current.readyToExecute || distToHole < 150) {
              // EXECUTE! Start the layout split animation
              state.current.layout = 'split';
              state.current.activeId = pid;
              // Wait 600ms for 3D animation to finish, THEN open the web window
              setTimeout(() => setExpandedProject(PROJECTS.find(p => p.id === pid)), 600);
            }
            state.current.readyToExecute = false;
          }
        } 
        
        else if (state.current.layout === 'split') {
          // CLOSING A WINDOW (Dragging from Right hole -> to Left slot)
          const distToSlot = Math.hypot(indexX - activeSlot.x, indexY - activeSlot.y);
          if (isPinching) {
            if (distToSlot < 150) {
              isSnapped = true; pState.currX = activeSlot.x; pState.currY = activeSlot.y; state.current.readyToExecute = true; 
            } else {
              pState.currX = indexX; pState.currY = indexY; if (distToSlot > 250) state.current.readyToExecute = false; 
            }
          } else {
            state.current.draggedId = null;
            if (state.current.readyToExecute || distToSlot < 150) {
              // SHUT DOWN! Start closing animation
              setExpandedProject(null); // Instantly hide webpage
              state.current.layout = 'central';
              state.current.activeId = null;
            }
            state.current.readyToExecute = false;
          }
        }
      }

      // STREAM DATA TO 3D SCENE
      handsPositionRef.current.uiState = {
        phase, layout: state.current.layout, projects: state.current.projects,
        holePos: state.current.layout === 'split' ? state.current.holeSplit : state.current.holeCentral,
        draggedId: state.current.draggedId, activeId: state.current.activeId, isSnapped, screenW, screenH
      };

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    updateLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mounted, phase, expandedProject]); 

  if (!mounted) return null;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 10 }}>
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

      {/* DYNAMIC LABELS (Follow the animated slots) */}
      {phase === 'main' && PROJECTS.map(p => {
        const pState = state.current.projects[p.id];
        if (!pState.slotPos) return null;
        return (
          <div key={p.id} style={{ 
            position: 'absolute', left: pState.slotPos.x, top: pState.slotPos.y - 80, 
            transform: 'translateX(-50%)', color: '#00ffcc', fontFamily: 'monospace', 
            // Hide the labels when expanded so the screen is clean
            opacity: state.current.layout === 'split' ? 0 : 1, transition: 'opacity 0.3s' 
          }}>
            <strong>{p.title}</strong>
          </div>
        )
      })}

      {/* DYNAMIC EXECUTE LABEL (Follows the hole) */}
      {phase === 'main' && state.current.layout === 'central' && (
        <div style={{ 
          position: 'absolute', left: state.current.holeCentral.x, top: state.current.holeCentral.y + 70, 
          transform: 'translateX(-50%)', color: '#00ffcc', fontFamily: 'monospace', fontWeight: 'bold' 
        }}>
          DRAG HERE TO INITIALIZE
        </div>
      )}

      {/* EXPANDED WINDOW: Positioned in the middle 50% of the screen */}
      {expandedProject && (
        <div style={{ 
          position: 'absolute', top: '15vh', left: '25vw', width: '50vw', height: '70vh', 
          backgroundColor: 'rgba(5, 10, 15, 0.9)', borderRadius: '16px', border: '1px solid #00ffcc', 
          zIndex: 100, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.4s ease-out' 
        }}>
          <div style={{ padding: '15px', borderBottom: '1px solid rgba(0,255,204,0.3)', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
            <span>{expandedProject.title}</span>
            <span style={{ color: '#ff0055', fontSize: '0.8rem', fontWeight: 'bold' }}>DRAG CUBE TO LEFT TO CLOSE</span>
          </div>
          <div style={{ flex: 1, padding: '10px', pointerEvents: 'auto' }}>
            <iframe src={expandedProject.url} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', backgroundColor: '#fff' }} />
          </div>
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