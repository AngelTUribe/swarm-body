import React, { useEffect, useRef, useState } from 'react';

const PROJECTS = [
  { id: 'p1', title: 'Interactive Portfolio', subtitle: 'WEB.DEV // 01', url: 'https://example.com' },
  { id: 'p2', title: 'Engineering Resume', subtitle: 'DOC.SYS // 02', url: 'resume.pdf' },
  { id: 'p3', title: 'Spatial Game', subtitle: 'SYS.RENDER // 03', url: 'about:blank' },
];

const PortfolioUI = ({ handsPositionRef }) => {
  const cursor1Ref = useRef(null);
  const cursor2Ref = useRef(null);
  const topBarRef = useRef(null);

  const [phase, setPhase] = useState('boot'); 
  const [expandedProject, setExpandedProject] = useState(null);
  const [mounted, setMounted] = useState(false);

  const state = useRef({
    draggedId: null,
    dragMode: null, 
    isExpanded: false, 
    zipperX: window.innerWidth * 0.35, 
    isDraggingZipper: false,
    readyToExecute: false, // NEW: Magnetic Latch State
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
      const dropCenterX = screenW / 2;
      const dropCenterY = screenH * 0.85;

      if (state.current.isExpanded && indexX !== null) {
        const topEl = topBarRef.current;
        if (topEl) {
          const topRect = topEl.getBoundingClientRect();
          if (indexX > topRect.left && indexX < topRect.right && indexY > topRect.top && indexY < topRect.bottom) {
            state.current.draggedId = expandedProject.id;
            state.current.dragMode = 'sticky'; 
            state.current.isExpanded = false;
            setExpandedProject(null);
          }
        }
      }

      if (!state.current.isExpanded && !state.current.draggedId && isPinching && indexX !== null) {
        for (let p of PROJECTS) {
          const pState = state.current.projects[p.id];
          if (Math.hypot(indexX - pState.currX, indexY - pState.currY) < 80) {
            state.current.draggedId = p.id;
            state.current.dragMode = 'pinch';
            state.current.readyToExecute = false;
            break; 
          }
        }
      }

      // === NEW SNAPPING LOGIC ===
      if (state.current.draggedId) {
        const pState = state.current.projects[state.current.draggedId];

        if (state.current.dragMode === 'sticky') {
          const distToOrig = Math.hypot(indexX - pState.origX, indexY - pState.origY);
          if (distToOrig < 150) {
            isSnapped = true; 
            pState.currX = pState.origX; pState.currY = pState.origY;
            if (distToOrig < 80) state.current.draggedId = null; // Auto drop if close enough
          } else {
            pState.currX = indexX; pState.currY = indexY;
          }
        } else {
          // Calculate distance from HAND to HOLE
          const distToHole = Math.hypot(indexX - dropCenterX, indexY - dropCenterY);
          
          if (isPinching) {
            if (distToHole < 150) {
              isSnapped = true; 
              pState.currX = dropCenterX; pState.currY = dropCenterY;
              state.current.readyToExecute = true; // LATCHED
            } else {
              pState.currX = indexX; pState.currY = indexY;
              if (distToHole > 250) state.current.readyToExecute = false; // Unlatch if pulled far away
            }
          } else {
            // Pinch Released! Did we release while latched?
            state.current.draggedId = null;
            if (state.current.readyToExecute || distToHole < 150) {
              setExpandedProject(PROJECTS.find(p => p.id === state.current.draggedId));
              state.current.isExpanded = true;
            }
            // Send back to slot, reset state
            pState.currX = pState.origX; pState.currY = pState.origY;
            state.current.readyToExecute = false;
          }
        }
      }

      handsPositionRef.current.uiState = {
        phase, isExpanded: state.current.isExpanded, projects: state.current.projects,
        draggedId: state.current.draggedId, isSnapped, screenW, screenH
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

      {/* MAIN UI */}
      {phase === 'main' && (
        <>
          {PROJECTS.map(p => (
            <div key={p.id} style={{ position: 'absolute', left: state.current.projects[p.id].origX, top: state.current.projects[p.id].origY - 80, transform: 'translateX(-50%)', color: '#00ffcc', fontFamily: 'monospace', opacity: state.current.isExpanded ? 0 : 1 }}>
              <strong>{p.title}</strong>
            </div>
          ))}
          {!state.current.isExpanded && (
            <div style={{ position: 'absolute', left: '50%', top: '85%', transform: 'translate(-50%, 70px)', color: '#00ffcc', fontFamily: 'monospace', fontWeight: 'bold' }}>
              DRAG HERE TO INITIALIZE
            </div>
          )}
        </>
      )}

      {/* EXPANDED WINDOW */}
      {expandedProject && (
        <div style={{ position: 'absolute', top: '10%', left: '10%', width: '80%', height: '75%', backgroundColor: 'rgba(5, 10, 15, 0.9)', borderRadius: '16px', border: '1px solid #00ffcc', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
          <div ref={topBarRef} style={{ padding: '15px', borderBottom: '1px solid rgba(0,255,204,0.3)', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
            <span>{expandedProject.title}</span>
            <span style={{ color: '#00ffcc', fontSize: '0.8rem' }}>::: HOVER TO CLOSE :::</span>
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