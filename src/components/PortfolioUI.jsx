import React, { useEffect, useRef, useState } from 'react';

const PROJECTS = [
  { id: 'p1', title: 'React Dashboard', subtitle: 'WEB.DEV // 01', url: 'https://example.com' },
  { id: 'p2', title: 'Swarm Engine', subtitle: 'SYS.RENDER // 02', url: 'https://example.com' },
  { id: 'p3', title: 'Neural Agent', subtitle: 'AI.LOGIC // 03', url: 'https://example.com' },
];

const PortfolioUI = ({ handsPositionRef }) => {
  const cursor1Ref = useRef(null);
  const cursor2Ref = useRef(null);
  const dropZoneRef = useRef(null);
  const zipperPullRef = useRef(null);
  const projectRefs = useRef({});

  const [phase, setPhase] = useState('boot'); // 'boot', 'transition', 'main'
  const [expandedProject, setExpandedProject] = useState(null);
  const [mounted, setMounted] = useState(false);

  const state = useRef({
    draggedId: null,
    isExpanded: false, 
    wasPinching: false, 
    lastHandX: null, 
    isDraggingZipper: false,
    zipperX: window.innerWidth * 0.35, // Zipper starts at 35% across the screen
    projects: {} 
  });

  useEffect(() => {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const centerX = screenW / 2;
    const centerY = screenH * 0.9; 
    const radius = Math.min(screenW, screenH) * 0.45; 
    const angles = [-40, 0, 40]; 

    PROJECTS.forEach((p, index) => {
      const rad = (angles[index] - 90) * (Math.PI / 180);
      const x = centerX + radius * Math.cos(rad) - 80; 
      const y = centerY + radius * Math.sin(rad) - 45; 
      state.current.projects[p.id] = { origX: x, origY: y, currX: x, currY: y };
    });
    
    state.current.zipperX = window.innerWidth * 0.35;
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

      let activePinchX = null;
      let activePinchY = null;
      let isPinching = false;
      let currentHandX = null;

      const processHand = (hand, cursorRef) => {
        const thumb = hand[4];
        const index = hand[8];
        const thumbX = (1 - thumb.x) * screenW;
        const thumbY = thumb.y * screenH;
        const indexX = (1 - index.x) * screenW;
        const indexY = index.y * screenH;

        if (cursorRef.current) cursorRef.current.style.transform = `translate(${indexX}px, ${indexY}px)`;

        const pinchDist = Math.hypot(thumbX - indexX, thumbY - indexY);
        const handIsPinching = pinchDist < 40;

        if (cursorRef.current) cursorRef.current.style.backgroundColor = handIsPinching ? '#00ffcc' : 'white';
        currentHandX = indexX;

        if (handIsPinching) {
          isPinching = true;
          activePinchX = indexX;
          activePinchY = indexY;
        }
      };

      if (hands[0]) processHand(hands[0], cursor1Ref);
      if (hands[1]) processHand(hands[1], cursor2Ref);

      // ==========================================
      // PHASE 1: THE ZIPPER ONBOARDING
      // ==========================================
      if (phase === 'boot' || phase === 'transition') {
        const zipperEl = zipperPullRef.current;
        const maskPath = document.getElementById('ar-mask-path'); 
        
        const startX = screenW * 0.35;
        const endX = screenW * 0.65;

        if (zipperEl && phase === 'boot') {
          const rect = zipperEl.getBoundingClientRect();
          const isHoveringZipper = activePinchX > rect.left - 50 && activePinchX < rect.right + 50 &&
                                   activePinchY > rect.top - 50 && activePinchY < rect.bottom + 50;

          if (isPinching && isHoveringZipper && !state.current.wasPinching) {
            state.current.isDraggingZipper = true;
          }
        }

        if (!isPinching) state.current.isDraggingZipper = false;

        if (state.current.isDraggingZipper && phase === 'boot') {
          state.current.zipperX = Math.max(startX, Math.min(activePinchX, screenW * 0.7)); 
        }

        const pullProgress = Math.max(0, (state.current.zipperX - startX) / (endX - startX));
        
        // Write Zipper State to the global ref so Three.js can spawn the particles!
        handsPositionRef.current.zipperState = {
          x: state.current.zipperX,
          progress: pullProgress,
          isDragging: state.current.isDraggingZipper,
          phase: phase
        };

        if (maskPath) {
          const zx = state.current.zipperX;
          const gap = pullProgress * (screenH * 0.6); 
          const d = `
            M 0 0 L ${screenW} 0 L ${screenW} ${screenH} L 0 ${screenH} Z 
            M 0 ${screenH/2 - gap} 
            Q ${zx/2} ${screenH/2 - gap} ${zx} ${screenH/2} 
            Q ${zx/2} ${screenH/2 + gap} 0 ${screenH/2 + gap} Z
          `;
          maskPath.setAttribute('d', d);
        }

        if (zipperEl) zipperEl.style.transform = `translate(${state.current.zipperX}px, -50%)`;

        // Win Condition: Trigger Transition
        if (state.current.zipperX > endX && phase === 'boot') {
          setPhase('transition'); // Tells Three.js to Sprawl!
          if (maskPath) maskPath.style.opacity = '0'; 
          
          setTimeout(() => {
            setPhase('main');
          }, 1200); // Give the particles 1.2s to fly at the camera
        }

        state.current.wasPinching = isPinching;
        animationFrameId = requestAnimationFrame(updateLoop);
        return; 
      }

      // ==========================================
      // PHASE 2 & 3: MAIN OS LOGIC
      // ==========================================
      // (Tell Three.js the boot is over)
      handsPositionRef.current.zipperState = { phase: 'main' };

      if (state.current.isExpanded) {
        if (currentHandX !== null && state.current.lastHandX !== null) {
          const velocityX = currentHandX - state.current.lastHandX;
          if (Math.abs(velocityX) > 100) { 
            setExpandedProject(null);
            state.current.isExpanded = false;
          }
        }
        state.current.lastHandX = currentHandX;

        const windowLeft = screenW * 0.1; const windowRight = screenW * 0.9;
        const windowTop = screenH * 0.1; const windowBottom = screenH * 0.9;

        if (isPinching && !state.current.wasPinching) {
          const clickedOutside = activePinchX < windowLeft || activePinchX > windowRight || activePinchY < windowTop || activePinchY > windowBottom;
          if (clickedOutside) {
            setExpandedProject(null);
            state.current.isExpanded = false;
          }
        }
        state.current.wasPinching = isPinching;
        animationFrameId = requestAnimationFrame(updateLoop);
        return; 
      }

      state.current.lastHandX = null; 
      const dropZoneEl = dropZoneRef.current;

      if (dropZoneEl && phase === 'main') {
        const dropRect = dropZoneEl.getBoundingClientRect();
        const dropCenterX = dropRect.left + dropRect.width / 2;
        const dropCenterY = dropRect.top + dropRect.height / 2;

        if (!state.current.draggedId && isPinching && activePinchX !== null) {
          for (let p of PROJECTS) {
            const el = projectRefs.current[p.id];
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            if (activePinchX > rect.left && activePinchX < rect.right && activePinchY > rect.top && activePinchY < rect.bottom) {
              state.current.draggedId = p.id; break; 
            }
          }
        }

        let isMagnetized = false;
        if (state.current.draggedId) {
          const pid = state.current.draggedId;
          const pState = state.current.projects[pid];
          const el = projectRefs.current[pid];
          const btnW = 160; const btnH = 90;

          if (isPinching) {
            const dist = Math.hypot(activePinchX - dropCenterX, activePinchY - dropCenterY);
            if (dist < 150) {
              pState.currX = dropCenterX - btnW / 2; pState.currY = dropCenterY - btnH / 2; isMagnetized = true;
            } else {
              pState.currX = activePinchX - btnW / 2; pState.currY = activePinchY - btnH / 2;
            }
            el.style.zIndex = 200; el.style.transform = `translate(${pState.currX}px, ${pState.currY}px) scale(1.05)`; 
          } else {
            state.current.draggedId = null; el.style.zIndex = 10;
            const dist = Math.hypot((pState.currX + btnW / 2) - dropCenterX, (pState.currY + btnH / 2) - dropCenterY);
            if (dist < 100) {
              setExpandedProject(PROJECTS.find(p => p.id === pid)); state.current.isExpanded = true;
            }
            pState.currX = pState.origX; pState.currY = pState.origY; isMagnetized = false;
          }
        }

        if (isMagnetized) {
          dropZoneEl.style.transform = 'translateX(-50%) scale(1.1)'; dropZoneEl.style.backgroundColor = 'rgba(0, 255, 204, 0.4)'; dropZoneEl.style.borderColor = '#fff';
        } else {
          dropZoneEl.style.transform = 'translateX(-50%) scale(1)'; dropZoneEl.style.backgroundColor = 'rgba(0, 255, 204, 0.05)'; dropZoneEl.style.borderColor = 'rgba(0, 255, 204, 0.4)';
        }

        PROJECTS.forEach(p => {
          const el = projectRefs.current[p.id]; const pState = state.current.projects[p.id];
          if (el && pState) {
            if (state.current.draggedId !== p.id) el.style.transform = `translate(${pState.currX}px, ${pState.currY}px) scale(1)`;
            el.style.transition = state.current.draggedId === p.id ? 'none' : 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
            el.style.opacity = state.current.isExpanded ? 0 : 1; el.style.pointerEvents = state.current.isExpanded ? 'none' : 'auto';
          }
        });
        dropZoneEl.style.opacity = state.current.isExpanded ? 0 : 1;
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
      
      {/* ================================================= */}
      {/* 1. THE BOOT SCREEN (ZIPPER INTERFACE)             */}
      {/* ================================================= */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        opacity: (phase === 'boot' || phase === 'transition') ? 1 : 0, 
        pointerEvents: phase === 'boot' ? 'auto' : 'none',
        transition: 'opacity 0.5s ease-out'
      }}>
        
        {/* Sleek Instruction Box */}
        <div style={{ 
          position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', 
          width: '550px', padding: '30px', textAlign: 'center',
          backgroundColor: 'rgba(5, 10, 15, 0.7)', backdropFilter: 'blur(15px)',
          border: '1px solid rgba(0, 255, 204, 0.4)', borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,255,204,0.1)',
          opacity: phase === 'transition' ? 0 : 1, transition: 'opacity 0.3s ease-out'
        }}>
          <h2 style={{ color: '#fff', fontFamily: 'monospace', fontSize: '1.6rem', letterSpacing: '5px', margin: '0 0 15px 0' }}>
            SPATIAL HAND ENVIRONMENT
          </h2>
          <p style={{ color: '#00ffcc', fontFamily: 'sans-serif', fontSize: '1.1rem', lineHeight: '1.6', margin: 0, opacity: 0.9 }}>
            This interface is driven by physical hand tracking. <br/><br/>
            Hold your hand up. Bring your index finger and thumb together to <strong>pinch</strong> the zipper below, then physically pull it to the right to initialize.
          </p>
        </div>

        {/* The horizontal track line (condensed to center 30%) */}
        <div style={{
          position: 'absolute', top: '50%', left: '35%', width: '30%', height: '4px',
          borderBottom: '2px dotted rgba(0, 255, 204, 0.5)', transform: 'translateY(-50%)', zIndex: 5,
          opacity: phase === 'transition' ? 0 : 1, transition: 'opacity 0.3s ease-out'
        }} />

        {/* Realistic CSS Zipper Handle (Flipped 180 degrees) */}
        <div ref={zipperPullRef} style={{
          position: 'absolute', top: '50%', left: 0, 
          width: '65px', height: '24px', 
          display: 'flex', flexDirection: 'row-reverse', // <-- FLIPPED 1: Reverses the order of the blocks
          alignItems: 'center', 
          zIndex: 10, transform: 'translate(35vw, -50%)', marginLeft: '-32px',
          opacity: phase === 'transition' ? 0 : 1, transition: 'opacity 0.2s'
        }}>
          {/* Slider Body (The metal block) */}
          <div style={{ 
            width: '28px', height: '24px', backgroundColor: '#e0e0e0', 
            borderRadius: '4px 10px 10px 4px', // <-- FLIPPED 2: Curve is now on the right side
            boxShadow: 'inset -4px 0 0 #fff, inset 4px 0 0 #999, 0 0 20px rgba(0,255,204,0.9)', // Adjusted lighting
            position: 'relative', zIndex: 2
          }} />
          
          {/* Pull Tab (The dangling part with the hole) */}
          <div style={{ 
            width: '40px', height: '18px', backgroundColor: 'rgba(5, 15, 25, 0.9)', 
            border: '2px solid #00ffcc', 
            borderRadius: '10px 0 0 10px', // <-- FLIPPED 3: Tab curves outward to the left
            marginRight: '-6px', // <-- FLIPPED 4: Tucks the tab slightly under the metal block
            position: 'relative', zIndex: 1,
            boxShadow: '0 10px 20px rgba(0,0,0,0.5)'
          }}>
            {/* The hole inside the tab */}
            <div style={{ position: 'absolute', top: '4px', left: '8px', width: '14px', height: '6px', backgroundColor: 'transparent', border: '1px solid rgba(0,255,204,0.5)', borderRadius: '3px' }} />
          </div>
        </div>
      </div>

      {/* ================================================= */}
      {/* 2. THE MAIN UI & EXPANDED WINDOW                  */}
      {/* ================================================= */}
      <div style={{ opacity: phase === 'main' ? 1 : 0, pointerEvents: phase === 'main' ? 'auto' : 'none', transition: 'opacity 1.5s ease-in' }}>
        <div ref={dropZoneRef} style={{
            position: 'absolute', bottom: '15%', left: '50%', transform: 'translateX(-50%)', width: '280px', height: '100px', borderRadius: '12px',
            border: '2px dashed rgba(0, 255, 204, 0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(5, 10, 15, 0.5)', backdropFilter: 'blur(8px)', transition: 'all 0.2s ease-out'
          }}>
          <span style={{ color: '#fff', fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: '1.1rem', letterSpacing: '3px' }}>EXECUTE</span>
          <span style={{ color: '#00ffcc', fontFamily: 'monospace', fontSize: '0.8rem', marginTop: '5px' }}>[ DROP PROJECT HERE ]</span>
        </div>

        {PROJECTS.map((project) => (
          <div key={project.id} ref={el => projectRefs.current[project.id] = el} 
            style={{
              position: 'absolute', top: 0, left: 0, width: '160px', height: '90px', borderRadius: '8px', padding: '12px',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'sans-serif', color: '#fff', 
              background: 'linear-gradient(135deg, rgba(15, 30, 45, 0.8) 0%, rgba(5, 10, 15, 0.9) 100%)',
              borderTop: '2px solid #00ffcc', borderBottom: '2px solid rgba(0, 255, 204, 0.2)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)', borderRight: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(10px)', zIndex: 10,
              transform: `translate(${state.current.projects[project.id]?.origX || 0}px, ${state.current.projects[project.id]?.origY || 0}px) scale(${phase === 'main' ? 1 : 0})`,
              transition: 'opacity 0.3s ease-out'
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.7rem', color: '#00ffcc', fontFamily: 'monospace', letterSpacing: '1px' }}>{project.subtitle}</span>
              <div style={{ width: '6px', height: '6px', backgroundColor: '#00ffcc', borderRadius: '50%', boxShadow: '0 0 10px #00ffcc' }} />
            </div>
            <span style={{ fontWeight: '800', fontSize: '1.1rem', textTransform: 'uppercase', lineHeight: '1.1' }}>{project.title}</span>
          </div>
        ))}
      </div>

      {expandedProject && (
        <div style={{
          position: 'absolute', top: '10%', left: '10%', width: '80%', height: '80%', backgroundColor: 'rgba(5, 10, 15, 0.85)', borderRadius: '16px',
          border: '1px solid rgba(0, 255, 204, 0.5)', boxShadow: '0 0 80px rgba(0, 255, 204, 0.2)', backdropFilter: 'blur(20px)', zIndex: 300, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 25px', borderBottom: '1px solid rgba(0, 255, 204, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#00ffcc', borderRadius: '50%', boxShadow: '0 0 15px #00ffcc' }} />
              <span style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: '1.4rem', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>{expandedProject.title}</span>
            </div>
            <div style={{ color: '#00ffcc', display: 'flex', alignItems: 'center', fontFamily: 'monospace', fontSize: '0.9rem', opacity: 0.7, border: '1px solid rgba(0,255,204,0.3)', padding: '5px 10px', borderRadius: '4px' }}>
              &lt;&lt; SWIPE TO DISMISS
            </div>
          </div>
          <div style={{ flex: 1, padding: '15px' }}>
            <iframe src={expandedProject.url} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', pointerEvents: 'auto', backgroundColor: '#fff' }} title={expandedProject.title} />
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