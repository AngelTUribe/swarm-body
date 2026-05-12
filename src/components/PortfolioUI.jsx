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
          const pinch = Math.hypot(tx - ix, ty - iy) < 40;
          cursorRef.current.style.backgroundColor = pinch ? '#00ffcc' : 'white';
          return { ix, iy, pinch };
        }
        return null;
      };

      // Check both hands
      const hand1 = processHand(hands[0], cursor1Ref);
      const hand2 = processHand(hands[1], cursor2Ref);

      // Prioritize the hand currently pinching
      let activeHand = null;
      if (hand1?.pinch) activeHand = hand1;
      else if (hand2?.pinch) activeHand = hand2;
      else activeHand = hand1 || hand2;

      if (activeHand) {
        indexX = activeHand.ix; indexY = activeHand.iy;
        isPinching = activeHand.pinch;
      }

      // === PHASE 1: BOOT ===
      if (phase === 'boot' || phase === 'transition') {
        const startX = screenW * 0.35; const endX = screenW * 0.65;
        const maskPath = document.getElementById('ar-mask-path');

        if (phase === 'boot') {
          const hoveringZipper = indexX > startX - 50 && indexX < endX && indexY > screenH/2 - 50 && indexY < screenH/2 + 50;
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

      // 1. EXPANDED WINDOW: HOVER TO GRAB
      if (state.current.isExpanded && indexX !== null) {
        const topEl = topBarRef.current;
        if (topEl) {
          const topRect = topEl.getBoundingClientRect();
          if (indexX > topRect.left && indexX < topRect.right && indexY > topRect.top && indexY < topRect.bottom) {
            state.current.draggedId = expandedProject.id;
            state.current.dragMode = 'sticky'; 
            state.current.isExpanded = false;
            setExpandedProject(null);
            state.current.projects[expandedProject.id].currX = indexX;
            state.current.projects[expandedProject.id].currY = indexY;
          }
        }
      }

      // 2. MENU SLOT: PINCH TO GRAB
      if (!state.current.isExpanded && !state.current.draggedId && isPinching && indexX !== null) {
        for (let p of PROJECTS) {
          const pState = state.current.projects[p.id];
          if (Math.hypot(indexX - pState.currX, indexY - pState.currY) < 80) {
            state.current.draggedId = p.id;
            state.current.dragMode = 'pinch';
            break; 
          }
        }
      }

      // 3. MOVE DRAGGED CUBES
      if (state.current.draggedId) {
        const pid = state.current.draggedId;
        const pState = state.current.projects[pid];

        if (state.current.dragMode === 'sticky') {
          if (indexX !== null) {
            pState.currX = indexX; pState.currY = indexY;
            const distToOrig = Math.hypot(pState.currX - pState.origX, pState.currY - pState.origY);
            if (distToOrig < 150) {
              pState.currX = pState.origX; pState.currY = pState.origY;
              isSnapped = true; 
              if (distToOrig < 50) state.current.draggedId = null;
            }
          }
        } else if (state.current.dragMode === 'pinch') {
          if (isPinching) {
            pState.currX = indexX; pState.currY = indexY;
            const distToHole = Math.hypot(pState.currX - dropCenterX, pState.currY - dropCenterY);
            if (distToHole < 150) {
              pState.currX = dropCenterX; pState.currY = dropCenterY;
              isSnapped = true;
            }
          } else {
            const distToHole = Math.hypot(pState.currX - dropCenterX, pState.currY - dropCenterY);
            state.current.draggedId = null;
            if (distToHole < 100) {
              setExpandedProject(PROJECTS.find(p => p.id === pid));
              state.current.isExpanded = true;
            }
            pState.currX = pState.origX; pState.currY = pState.origY; 
          }
        }
      }

      // STREAM DATA TO 3D SCENE
      handsPositionRef.current.uiState = {
        phase, isExpanded: state.current.isExpanded, projects: state.current.projects,
        draggedId: state.current.draggedId, dragMode: state.current.dragMode, isSnapped, screenW, screenH
      };

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    updateLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mounted, phase, expandedProject]); 

  if (!mounted) return null;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 10 }}>
      {/* BOOT SCREEN UI */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: phase === 'boot' ? 1 : 0, transition: 'opacity 0.5s', zIndex: 50 }}>
        <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: '550px', padding: '30px', textAlign: 'center', backgroundColor: 'rgba(5, 10, 15, 0.7)', backdropFilter: 'blur(15px)', border: '1px solid rgba(0, 255, 204, 0.4)', borderRadius: '16px' }}>
          <h2 style={{ color: '#fff', fontFamily: 'monospace', fontSize: '1.6rem', letterSpacing: '5px', margin: '0 0 15px 0' }}>SPATIAL HAND ENVIRONMENT</h2>
          <p style={{ color: '#00ffcc', fontFamily: 'sans-serif', fontSize: '1.1rem', margin: 0 }}>Pinch the zipper and pull to initialize.</p>
        </div>
        <div id="zipper-handle" style={{ position: 'absolute', top: '50%', left: 0, width: '65px', height: '24px', display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', transform: 'translate(35vw, -50%)', marginLeft: '-32px' }}>
          <div style={{ width: '28px', height: '24px', backgroundColor: '#e0e0e0', borderRadius: '4px 10px 10px 4px', zIndex: 2 }} />
          <div style={{ width: '40px', height: '18px', backgroundColor: 'rgba(5, 15, 25, 0.9)', border: '2px solid #00ffcc', borderRadius: '10px 0 0 10px', marginRight: '-6px', zIndex: 1 }} />
        </div>
      </div>

      {/* PROJECT LABELS */}
      {phase === 'main' && PROJECTS.map(p => {
        const pState = state.current.projects[p.id];
        if (!pState) return null;
        return (
          <div key={`label-${p.id}`} style={{
            position: 'absolute', left: pState.origX, top: pState.origY - 85,
            transform: 'translateX(-50%)', color: '#00ffcc', fontFamily: 'monospace',
            fontSize: '0.9rem', textAlign: 'center', opacity: state.current.isExpanded ? 0 : 1, transition: 'opacity 0.3s'
          }}>
            <span style={{fontWeight:'bold', fontSize:'1.1rem'}}>{p.title}</span><br/>
            <span style={{fontSize:'0.7rem', color:'#fff'}}>{p.subtitle}</span>
          </div>
        )
      })}

      {/* EXECUTE LABEL */}
      {phase === 'main' && !state.current.isExpanded && (
        <div style={{
          position: 'absolute', left: '50%', top: '85%',
          transform: 'translate(-50%, 65px)', color: '#00ffcc', fontFamily: 'monospace',
          fontSize: '1rem', textAlign: 'center', textShadow: '0 0 15px rgba(0,255,204,0.8)'
        }}>
          <span style={{fontWeight:'bold', letterSpacing: '2px'}}>DRAG HERE TO INITIALIZE</span>
        </div>
      )}

      {/* WINDOW VIEW */}
      {expandedProject && (
        <div style={{
          position: 'absolute', top: '10%', left: '10%', width: '80%', height: '75%', backgroundColor: 'rgba(5, 10, 15, 0.85)', borderRadius: '16px',
          border: '1px solid rgba(0, 255, 204, 0.5)', backdropFilter: 'blur(20px)', zIndex: 300, display: 'flex', flexDirection: 'column'
        }}>
          <div ref={topBarRef} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 25px', borderBottom: '1px solid rgba(0, 255, 204, 0.2)', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>{expandedProject.title}</span>
            <span style={{ color: '#00ffcc', fontSize: '0.8rem' }}>::: HOVER TO CLOSE :::</span>
          </div>
          <div style={{ flex: 1, padding: '15px', pointerEvents: 'auto' }}>
            <iframe src={expandedProject.url} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', backgroundColor: '#fff' }} />
          </div>
        </div>
      )}

      <div ref={cursor1Ref} style={cursorStyle} />
      <div ref={cursor2Ref} style={cursorStyle} />
    </div>
  );
};

const cursorStyle = { position: 'absolute', width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', transformOrigin: 'center', marginLeft: '-10px', marginTop: '-10px', boxShadow: '0 0 15px rgba(0, 255, 204, 1)' };

export default PortfolioUI;