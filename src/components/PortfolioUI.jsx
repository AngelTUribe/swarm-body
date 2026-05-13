import React, { useEffect, useRef, useState } from 'react';

const PROJECTS = [
  { id: 'p1', title: 'Interactive Portfolio', subtitle: 'WEB.DEV // 01', url: 'https://angelturibe.github.io/my-portfolio/' },
  { id: 'p2', title: 'Engineering Resume', subtitle: 'DOC.SYS // 02', url: 'resume.pdf' },
  { id: 'p3', title: 'Spatial Game', subtitle: 'SYS.RENDER // 03', url: 'about:blank' },
];

const PortfolioUI = ({ handsPositionRef }) => {
  // Dual cursors are back for the Idle Phase!
  const cursor1Ref = useRef(null);
  const cursor2Ref = useRef(null);
  const topBarRef = useRef(null);
  
  const activeHandMemory = useRef({ position: null, locked: false, lostFrames: 0 });
  const pinchMemory = useRef({ isPinching: false, releasedFrames: 0 });

  const [phase, setPhase] = useState('boot'); 
  const [expandedProject, setExpandedProject] = useState(null);
  const [mounted, setMounted] = useState(false);

  const state = useRef({
    draggedId: null, activeId: null, layout: 'central', hasLeftOrigin: false, 
    zipperX: window.innerWidth * 0.35, isDraggingZipper: false,
    holeCurrX: window.innerWidth / 2, holeCurrY: window.innerHeight * 0.65,
    holeCentral: { x: 0, y: 0 }, holeSplit: { x: 0, y: 0 }, projects: {} 
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
        central: { x: cx, y: cy }, split: { x: sx, y: sy }, 
        currX: cx, currY: cy, slotCurrX: cx, slotCurrY: cy, cooldownUntil: 0 
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

      let activeHand = null;
      let indexX = null; 
      let indexY = null; 
      let isLocked = activeHandMemory.current.locked;

      // 1. Process all visible hands
      const processedHands = hands.map(h => {
        if (!h[8] || !h[4]) return null;
        const ix = (1 - h[8].x) * screenW;
        const iy = h[8].y * screenH;
        const tx = (1 - h[4].x) * screenW;
        const ty = h[4].y * screenH;
        const isPinching = Math.hypot(tx - ix, ty - iy) < 60;
        return { raw: h, ix, iy, tx, ty, isPinching };
      }).filter(Boolean);

      // === ACTION PHASE: HARD LOCK ===
      if (isLocked) {
        if (activeHandMemory.current.position) {
          const lastPos = activeHandMemory.current.position;
          let bestHand = null;
          let minDist = Infinity;
          processedHands.forEach(ph => {
            const dist = Math.hypot(ph.raw[8].x - lastPos.x, ph.raw[8].y - lastPos.y);
            if (dist < minDist) { minDist = dist; bestHand = ph; }
          });

          if (bestHand && minDist < 0.2) {
            activeHand = bestHand;
            activeHandMemory.current.lostFrames = 0;
          }
        }

        if (!activeHand) {
          activeHandMemory.current.lostFrames++;
          if (activeHandMemory.current.lostFrames > 15) {
            activeHandMemory.current.locked = false;
            isLocked = false;
            activeHandMemory.current.position = null;
            state.current.draggedId = null;
            state.current.isDraggingZipper = false;
            pinchMemory.current.isPinching = false; 
          } else if (activeHandMemory.current.position) {
            indexX = (1 - activeHandMemory.current.position.x) * screenW;
            indexY = activeHandMemory.current.position.y * screenH;
          }
        } else {
          activeHandMemory.current.position = activeHand.raw[8];
          indexX = activeHand.ix;
          indexY = activeHand.iy;

          // Slip Buffer updates ONLY for the locked hand
          if (activeHand.isPinching) {
            pinchMemory.current.isPinching = true;
            pinchMemory.current.releasedFrames = 0;
          } else {
            pinchMemory.current.releasedFrames++;
            if (pinchMemory.current.releasedFrames > 10) pinchMemory.current.isPinching = false;
          }
        }

        const safePinching = pinchMemory.current.isPinching;

        // UNLOCK TRIGGER: If hand fully opens AND isn't holding a cube/zipper
        if (activeHand && !safePinching && !state.current.draggedId && !state.current.isDraggingZipper) {
          activeHandMemory.current.locked = false;
          isLocked = false;
          activeHand = null;
          indexX = null;
          indexY = null;
        }
      }

      // === IDLE PHASE: WAITING FOR INTENT ===
      if (!isLocked) {
        const pinchingHand = processedHands.find(ph => ph.isPinching);
        
        // The exact moment ANY hand pinches, we hard lock onto it
        if (pinchingHand) {
          activeHandMemory.current.locked = true;
          activeHandMemory.current.lostFrames = 0;
          activeHandMemory.current.position = pinchingHand.raw[8];
          isLocked = true;
          activeHand = pinchingHand;
          indexX = pinchingHand.ix;
          indexY = pinchingHand.iy;
          pinchMemory.current.isPinching = true;
          pinchMemory.current.releasedFrames = 0;
        } else {
          // No one is pinching. Just hover.
          indexX = null;
          indexY = null;
          pinchMemory.current.isPinching = false;
        }
      }

      const finalIsPinching = pinchMemory.current.isPinching;

      // === DYNAMIC CURSOR RENDERING ===
      const hideCursors = expandedProject !== null; // Hides dots when window is open!

      if (hideCursors) {
          if (cursor1Ref.current) cursor1Ref.current.style.opacity = 0;
          if (cursor2Ref.current) cursor2Ref.current.style.opacity = 0;
      } else {
          if (!isLocked) {
              // IDLE: Render both ghosts
              if (cursor1Ref.current) {
                  if (processedHands[0]) {
                      cursor1Ref.current.style.opacity = 1;
                      cursor1Ref.current.style.transform = `translate(${processedHands[0].ix}px, ${processedHands[0].iy}px)`;
                      cursor1Ref.current.style.backgroundColor = 'white';
                  } else cursor1Ref.current.style.opacity = 0;
              }
              if (cursor2Ref.current) {
                  if (processedHands[1]) {
                      cursor2Ref.current.style.opacity = 1;
                      cursor2Ref.current.style.transform = `translate(${processedHands[1].ix}px, ${processedHands[1].iy}px)`;
                      cursor2Ref.current.style.backgroundColor = 'white';
                  } else cursor2Ref.current.style.opacity = 0;
              }
          } else {
              // LOCKED: Render only the active hand
              if (cursor1Ref.current) {
                  if (indexX !== null) {
                      cursor1Ref.current.style.opacity = 1;
                      cursor1Ref.current.style.transform = `translate(${indexX}px, ${indexY}px)`;
                      cursor1Ref.current.style.backgroundColor = (finalIsPinching || state.current.draggedId) ? '#00ffcc' : 'white';
                  } else cursor1Ref.current.style.opacity = 0;
              }
              if (cursor2Ref.current) cursor2Ref.current.style.opacity = 0; // Hide the secondary hand
          }
      }

      // === BOOT PHASE ===
        if (phase === 'boot' || phase === 'transition') {
          const startX = screenW * 0.35; const endX = screenW * 0.65;
          const maskPath = document.getElementById('ar-mask-path');
  
          if (phase === 'boot' && indexX !== null) {
            const hoveringZipper = indexX > startX - 50 && indexX < endX + 50 && indexY > screenH/2 - 100 && indexY < screenH/2 + 100;
            if (finalIsPinching && hoveringZipper) state.current.isDraggingZipper = true;
            if (!finalIsPinching) state.current.isDraggingZipper = false;
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
            setPhase('transition'); 
            
            // THE FIX: Force the zipper drag state to false so the hand unlocks!
            state.current.isDraggingZipper = false; 
            
            if (maskPath) maskPath.style.opacity = '0'; 
            setTimeout(() => setPhase('main'), 1200); 
          }
          animationFrameId = requestAnimationFrame(updateLoop); return; 
        }

      handsPositionRef.current.zipperState = { phase: 'main' };

      // === PHYSICS GLIDE ===
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

      // === GRAB DETECTION WITH COOLDOWN ===
      if (!state.current.draggedId && finalIsPinching && indexX !== null) {
        for (let p of PROJECTS) {
          const pState = state.current.projects[p.id];
          
          if (Date.now() < pState.cooldownUntil) continue;

          if (Math.hypot(indexX - pState.currX, indexY - pState.currY) < 80) {
            state.current.draggedId = p.id;
            state.current.hasLeftOrigin = false; 
            break; 
          }
        }
      }

      if (state.current.draggedId && indexX !== null) {
        const pid = state.current.draggedId;
        const pState = state.current.projects[pid];
        
        const activeHole = state.current.layout === 'split' ? state.current.holeSplit : state.current.holeCentral;
        const activeSlot = state.current.layout === 'split' ? pState.split : pState.central; 

        pState.currX = indexX; pState.currY = indexY;

        const distToHole = Math.hypot(indexX - activeHole.x, indexY - activeHole.y);
        const distToSlot = Math.hypot(indexX - activeSlot.x, indexY - activeSlot.y);
        const dropThreshold = 120; 

        const overValidTarget = distToHole < dropThreshold || distToSlot < dropThreshold;
        if (!finalIsPinching && overValidTarget) state.current.draggedId = null;

        if (!state.current.hasLeftOrigin) {
          if (state.current.layout === 'central' && distToSlot > 150) state.current.hasLeftOrigin = true;
          if (state.current.layout === 'split' && distToHole > 150) state.current.hasLeftOrigin = true;
        }

        if (state.current.hasLeftOrigin && state.current.draggedId === null) {
          if (state.current.layout === 'central') {
            if (distToHole < dropThreshold) {
              isSnapped = true; pState.currX = activeHole.x; pState.currY = activeHole.y; 
              state.current.layout = 'split'; state.current.activeId = pid;
              pState.cooldownUntil = Date.now() + 1500; 
              setTimeout(() => setExpandedProject(PROJECTS.find(p => p.id === pid)), 600);
            } else if (distToSlot < dropThreshold) {
              isSnapped = true; pState.currX = activeSlot.x; pState.currY = activeSlot.y; 
              pState.cooldownUntil = Date.now() + 1500; 
            }
          } 
          else if (state.current.layout === 'split') {
            if (distToSlot < dropThreshold) {
              isSnapped = true; pState.currX = activeSlot.x; pState.currY = activeSlot.y; 
              setExpandedProject(null); state.current.layout = 'central'; state.current.activeId = null;
              pState.cooldownUntil = Date.now() + 1500; 
            } else if (distToHole < dropThreshold) {
               isSnapped = true; pState.currX = activeHole.x; pState.currY = activeHole.y; 
               pState.cooldownUntil = Date.now() + 1500; 
            }
          }
        }
      }

      handsPositionRef.current.uiState = {
        phase, layout: state.current.layout, projects: state.current.projects,expandedId: expandedProject ? expandedProject.id : null,
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

      {/* DYNAMIC EXECUTE LABEL */}
      {phase === 'main' && (
        <div id="execute-label" style={{ position: 'absolute', left: state.current.holeCurrX, top: state.current.holeCurrY + 70, transform: 'translateX(-50%)', color: '#00ffcc', fontFamily: 'monospace', fontWeight: 'bold', transition: 'opacity 0.3s' }}>
          DRAG HERE TO INITIALIZE
        </div>
      )}

      {/* EXPANDED WINDOW */}
      {expandedProject && (
        <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: '50vw', height: '70vh', backgroundColor: expandedProject.id === 'p3' ? 'transparent' : 'rgba(5, 10, 15, 0.85)', borderRadius: '16px', border: expandedProject.id === 'p3' ? 'none' : '1px solid rgba(0, 255, 204, 0.5)', boxShadow: expandedProject.id === 'p3' ? 'none' : '0 0 80px rgba(0, 255, 204, 0.2)', backdropFilter: expandedProject.id === 'p3' ? 'none' : 'blur(20px)', zIndex: 300, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.3s ease-out' }}>
          <div ref={topBarRef} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 25px', borderBottom: expandedProject.id === 'p3' ? 'none' : '1px solid rgba(0, 255, 204, 0.2)', backgroundColor: expandedProject.id === 'p3' ? 'rgba(255, 0, 255, 0.15)' : 'rgba(0, 255, 204, 0.05)', border: expandedProject.id === 'p3' ? '1px solid #ff00ff' : 'none', borderRadius: expandedProject.id === 'p3' ? '16px' : '16px 16px 0 0', backdropFilter: 'blur(10px)', pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: expandedProject.id === 'p3' ? '#ff00ff' : '#00ffcc', boxShadow: `0 0 15px ${expandedProject.id === 'p3' ? '#ff00ff' : '#00ffcc'}` }} />
              <span style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: '1.4rem', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>
                {expandedProject.id === 'p3' ? 'SPATIAL DRIVE' : expandedProject.title}
              </span>
            </div>
            <div style={{ color: expandedProject.id === 'p3' ? '#ff00ff' : '#00ffcc', fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold' }}>
              ::: CLOSE VIA BROWSER DEV TOOLS FOR NOW :::
            </div>
          </div>
          {expandedProject.id !== 'p3' && (
            <div style={{ flex: 1, padding: '15px', pointerEvents: 'auto' }}>
              <iframe src={expandedProject.url} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', backgroundColor: '#fff' }} title={expandedProject.title} />
            </div>
          )}
          {expandedProject.id === 'p3' && (
            <div style={{ color: '#ff00ff', fontFamily: 'monospace', textAlign: 'center', marginTop: '30px', textShadow: '0 0 10px #ff00ff' }}>
              <h2 style={{ letterSpacing: '3px' }}>[ ONE-HANDED DRIVE SYSTEM ACTIVE ]</h2>
              <p style={{ fontSize: '1.2rem' }}><b>GAS:</b> Open Palm &nbsp; | &nbsp; <b>BRAKE/REVERSE:</b> Closed Fist</p>
              <p style={{ fontSize: '1.2rem' }}><b>STEER:</b> Move hand left/right</p>
            </div>
          )}
        </div>
      )}

      {/* DUAL CURSORS */}
      <div ref={cursor1Ref} style={cursorStyle} />
      <div ref={cursor2Ref} style={cursorStyle} />
    </div>
  );
};

const cursorStyle = { position: 'absolute', width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', transformOrigin: 'center', marginLeft: '-10px', marginTop: '-10px', boxShadow: '0 0 15px #00ffcc', zIndex: 1000, opacity: 0, transition: 'background-color 0.2s' };

export default PortfolioUI;