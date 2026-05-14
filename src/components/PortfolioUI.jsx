import React, { useEffect, useRef, useState } from 'react';

const PROJECTS = [
  { id: 'p1', title: 'Interactive Portfolio', subtitle: 'WEB.DEV // 01', url: 'https://angelturibe.github.io/my-portfolio/' },
  { id: 'p2', title: 'Engineering Resume', subtitle: 'DOC.SYS // 02', url: 'resume.pdf' },
  { id: 'p3', title: 'Spatial Game', subtitle: 'SYS.RENDER // 03', url: 'about:blank' },
];

const PortfolioUI = ({ handsPositionRef }) => {
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
    const radius = Math.min(screenW, screenH) * 0.50; 
    const angles = [-57, 0, 57]; 

    state.current.holeCentral = { x: screenW / 2, y: centerY };
    state.current.holeSplit = { x: screenW * 0.25, y: screenH * 0.5 }; 
    state.current.holeCurrX = screenW / 2;
    state.current.holeCurrY = centerY;

    PROJECTS.forEach((p, index) => {
      const rad = (angles[index] - 90) * (Math.PI / 180);
      const cx = (screenW / 2) + radius * Math.cos(rad); 
      const cy = centerY + radius * Math.sin(rad); 
      const sx = screenW * 0.10;
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
      let isBuffering = false;

      const processedHands = hands.map(h => {
        if (!h[8] || !h[4]) return null;
        const ix = (1 - h[8].x) * screenW;
        const iy = h[8].y * screenH;
        const tx = (1 - h[4].x) * screenW;
        const ty = h[4].y * screenH;
        const isPinching = Math.hypot(tx - ix, ty - iy) < 60;
        return { raw: h, ix, iy, tx, ty, isPinching };
      }).filter(Boolean);

      if (isLocked) {
        if (activeHandMemory.current.position) {
          const lastPos = activeHandMemory.current.position;
          let bestHand = null;
          let minDist = Infinity;
          processedHands.forEach(ph => {
            const dist = Math.hypot(ph.raw[8].x - lastPos.x, ph.raw[8].y - lastPos.y);
            if (dist < minDist) { minDist = dist; bestHand = ph; }
          });

          if (bestHand && minDist < 0.08) {
            activeHand = bestHand;
            activeHandMemory.current.lostFrames = 0;
          }
        }

        if (!activeHand) {
          isBuffering = true;
          activeHandMemory.current.lostFrames++;
          
          const lostThreshold = state.current.draggedId ? 60 : 15; 
          
          if (activeHandMemory.current.lostFrames > lostThreshold) {
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

          if (activeHand.isPinching) {
            pinchMemory.current.isPinching = true;
            pinchMemory.current.releasedFrames = 0;
          } else {
            pinchMemory.current.releasedFrames++;
            
            const pinchThreshold = state.current.draggedId ? 30 : 10;
            if (pinchMemory.current.releasedFrames > pinchThreshold) {
                pinchMemory.current.isPinching = false;
            }
          }
        }

        const safePinching = pinchMemory.current.isPinching;

        if (activeHand && !safePinching && !state.current.draggedId && !state.current.isDraggingZipper) {
          activeHandMemory.current.locked = false;
          isLocked = false;
          activeHand = null;
          indexX = null;
          indexY = null;
        }
      }

      if (!isLocked) {
        const pinchingHand = processedHands.find(ph => ph.isPinching);
        
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
          indexX = null;
          indexY = null;
          pinchMemory.current.isPinching = false;
        }
      }

      const finalIsPinching = pinchMemory.current.isPinching;
      const hideCursors = expandedProject !== null; 

      if (hideCursors) {
          if (cursor1Ref.current) cursor1Ref.current.style.opacity = 0;
          if (cursor2Ref.current) cursor2Ref.current.style.opacity = 0;
      } else {
          if (!isLocked) {
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
            if (cursor1Ref.current) {
                if (indexX !== null) {
                    cursor1Ref.current.style.opacity = 1;
                    
                    if (isBuffering) {
                        cursor1Ref.current.style.backgroundColor = 'transparent';
                        cursor1Ref.current.style.border = '4px solid #ffcc00';
                        cursor1Ref.current.style.borderTopColor = 'transparent';
                        cursor1Ref.current.style.boxShadow = '0 0 10px #ffcc00';
                        cursor1Ref.current.classList.add('loading-spinner');
                        
                        cursor1Ref.current.style.transform = ``; 
                        cursor1Ref.current.style.setProperty('--cx', `${indexX}px`);
                        cursor1Ref.current.style.setProperty('--cy', `${indexY}px`);
                    } else {
                        cursor1Ref.current.style.backgroundColor = (finalIsPinching || state.current.draggedId) ? '#00ffcc' : 'white';
                        cursor1Ref.current.style.border = 'none';
                        cursor1Ref.current.style.boxShadow = '0 0 15px #00ffcc';
                        cursor1Ref.current.classList.remove('loading-spinner');
                        
                        cursor1Ref.current.style.transform = `translate(${indexX}px, ${indexY}px)`;
                    }
                } else cursor1Ref.current.style.opacity = 0;
            }
            if (cursor2Ref.current) cursor2Ref.current.style.opacity = 0; 
        }
      }

        if (phase === 'boot' || phase === 'transition') {
          const startX = screenW * 0.35; const endX = screenW * 0.65;
          const maskPath = document.getElementById('ar-mask-path');
          
          const zipperY = screenH * 0.75; 
  
          if (phase === 'boot' && indexX !== null) {
            const hoveringZipper = indexX > startX - 50 && indexX < endX + 50 && indexY > zipperY - 100 && indexY < zipperY + 100;
            if (finalIsPinching && hoveringZipper) state.current.isDraggingZipper = true;
            if (!finalIsPinching) state.current.isDraggingZipper = false;
            if (state.current.isDraggingZipper) state.current.zipperX = Math.max(startX, Math.min(indexX, screenW * 0.7)); 
          }
  
          const pullProgress = Math.max(0, (state.current.zipperX - startX) / (endX - startX));
          handsPositionRef.current.zipperState = { x: state.current.zipperX, progress: pullProgress, phase };
  
          if (maskPath) {
            const zx = state.current.zipperX; const gap = pullProgress * (screenH * 0.6); 
            maskPath.setAttribute('d', `M 0 0 L ${screenW} 0 L ${screenW} ${screenH} L 0 ${screenH} Z M 0 ${zipperY - gap} Q ${zx/2} ${zipperY - gap} ${zx} ${zipperY} Q ${zx/2} ${zipperY + gap} 0 ${zipperY + gap} Z`);
          }
  
          const zipperEl = document.getElementById('zipper-handle');
          if (zipperEl) zipperEl.style.transform = `translate(${state.current.zipperX}px, -50%)`;
  
          if (state.current.zipperX > endX && phase === 'boot') {
            setPhase('transition'); 
            state.current.isDraggingZipper = false; 
            
            if (maskPath) maskPath.style.opacity = '0'; 
            setTimeout(() => setPhase('main'), 1200); 
          }
          animationFrameId = requestAnimationFrame(updateLoop); return; 
        }

      handsPositionRef.current.zipperState = { phase: 'main' };

      let isSnapped = false; 
      const targetHole = state.current.layout === 'split' ? state.current.holeSplit : state.current.holeCentral;
      state.current.holeCurrX += (targetHole.x - state.current.holeCurrX) * 0.1;
      state.current.holeCurrY += (targetHole.y - state.current.holeCurrY) * 0.1;

      const execLabel = document.getElementById('execute-label');
      if (execLabel) {
        execLabel.style.left = `${state.current.holeCurrX}px`;
        execLabel.style.top = `${state.current.holeCurrY + 120}px`;
        execLabel.style.opacity = state.current.layout === 'split' ? '0' : '1';
      }

      const tether1 = document.getElementById('tether-path-1');
      if (tether1 && state.current.layout === 'split') {
         const hx = state.current.holeCurrX;
         const hy = state.current.holeCurrY;
         const winLeft = screenW * 0.35; 
         
         const p1 = screenH * 0.20;
         const p2 = screenH * 0.35;
         const p3 = screenH * 0.50;
         const p4 = screenH * 0.65;
         const p5 = screenH * 0.80;

         const cpX = hx + (winLeft - hx) * 0.5;

         const setPath = (id, destY, flareY) => {
           const pathEl = document.getElementById(id);
           const ballEl = document.getElementById(`${id}-balls`);
           if (pathEl) {
             const cy = hy + (destY - hy) * flareY;
             const d = `M ${hx} ${hy} Q ${cpX} ${cy} ${winLeft} ${destY}`;
             pathEl.setAttribute('d', d);
             if (ballEl) ballEl.setAttribute('d', d);
           }
         };

         setPath('tether-path-1', p1, -0.4);
         setPath('tether-path-2', p2, -0.2);
         setPath('tether-path-3', p3, 0);   
         setPath('tether-path-4', p4, 0.2);
         setPath('tether-path-5', p5, 0.4);
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

      if (!state.current.draggedId && finalIsPinching && indexX !== null) {
        for (let p of PROJECTS) {
          const pState = state.current.projects[p.id];
          
          if (Date.now() < pState.cooldownUntil) continue;
          if (state.current.layout === 'split' && state.current.activeId !== p.id) continue;

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

        pState.currX = indexX; 
        pState.currY = indexY;

        const distToHole = Math.hypot(indexX - activeHole.x, indexY - activeHole.y);
        const distToSlot = Math.hypot(indexX - activeSlot.x, indexY - activeSlot.y);
        const snapThreshold = 160; 

        if (!state.current.hasLeftOrigin) {
          if (state.current.layout === 'central' && distToSlot > snapThreshold) state.current.hasLeftOrigin = true;
          if (state.current.layout === 'split' && distToHole > snapThreshold) state.current.hasLeftOrigin = true;
        }

        if (state.current.hasLeftOrigin) {
            let overTarget = false;
            if (state.current.layout === 'central' && distToHole < snapThreshold) overTarget = true;
            if (state.current.layout === 'split' && distToSlot < snapThreshold) overTarget = true;
            
            if (overTarget || !finalIsPinching) {
                state.current.draggedId = null; 
            }
        } else if (!finalIsPinching) {
            state.current.draggedId = null;
        }

        if (state.current.hasLeftOrigin && state.current.draggedId === null) {
          if (state.current.layout === 'central') {
            if (distToHole < snapThreshold) {
              isSnapped = true; 
              pState.currX = activeHole.x; 
              pState.currY = activeHole.y; 
              state.current.layout = 'split'; 
              state.current.activeId = pid;
              pState.cooldownUntil = Date.now() + 2000; 
              setTimeout(() => setExpandedProject(PROJECTS.find(p => p.id === pid)), 600);
            } else if (distToSlot < snapThreshold) {
              isSnapped = true; 
              pState.currX = activeSlot.x; 
              pState.currY = activeSlot.y; 
              pState.cooldownUntil = Date.now() + 1500; 
            }
          } 
          else if (state.current.layout === 'split') {
            if (distToSlot < snapThreshold) {
              isSnapped = true; 
              pState.currX = activeSlot.x; 
              pState.currY = activeSlot.y; 
              setExpandedProject(null); 
              state.current.layout = 'central'; 
              state.current.activeId = null;
              pState.cooldownUntil = Date.now() + 2000; 
            } else if (distToHole < snapThreshold) {
               isSnapped = true; 
               pState.currX = activeHole.x; 
               pState.currY = activeHole.y; 
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
      <style>
        {`
          .loading-spinner {
            animation: spin-cursor 1s linear infinite !important;
          }
          @keyframes spin-cursor {
            0% { transform: translate(var(--cx), var(--cy)) rotate(0deg); }
            100% { transform: translate(var(--cx), var(--cy)) rotate(360deg); }
          }
          .pulse-text {
            animation: pulse-opacity 2s ease-in-out infinite;
          }
          @keyframes pulse-opacity {
            0%, 100% { opacity: 1; text-shadow: 0 0 15px #00ffcc; }
            50% { opacity: 0.4; text-shadow: none; }
          }
          .data-tether-base {
            animation: web-breathe 4s ease-in-out infinite alternate;
          }
          @keyframes web-breathe {
            0% { stroke-opacity: 0.2; stroke-width: 1px; }
            100% { stroke-opacity: 0.8; stroke-width: 2.5px; }
          }
          .data-balls {
            stroke-linecap: round;
            stroke-dasharray: 0 300; 
            animation: flow-data 3s linear infinite;
          }
          .data-balls-fast {
            stroke-linecap: round;
            stroke-dasharray: 0 200;
            animation: flow-data 1.4s linear infinite;
          }
          @keyframes flow-data {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: -600; }
          }
        `}
      </style>

      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: phase === 'boot' ? 1 : 0, transition: 'opacity 0.5s', zIndex: 50 }}>
        <div style={{ position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)', width: '85%', maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4vh' }}>
          
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ color: '#fff', fontFamily: '"Fira Mono", monospace', fontSize: '2.5rem', letterSpacing: '8px', margin: '0', textShadow: '0 0 20px rgba(0, 255, 204, 0.5)' }}>
              SPATIAL_HAND_ENVIRONMENT
            </h1>
            <div style={{ color: '#00ffcc', fontFamily: '"Fira Mono", monospace', fontSize: '1rem', letterSpacing: '6px', marginTop: '10px' }}>
              [ SYSTEM INITIALIZATION ]
            </div>
          </div>

          <div style={{ backgroundColor: 'rgba(5, 10, 15, 0.65)', border: '1px solid rgba(0, 255, 204, 0.3)', borderLeft: '4px solid #00ffcc', padding: '30px', width: '100%', backdropFilter: 'blur(10px)', boxSizing: 'border-box', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            <h3 style={{ color: '#fff', fontFamily: '"Fira Mono", monospace', marginTop: 0, marginBottom: '20px', letterSpacing: '2px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
              // USER INTERFACE MANUAL
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#a0b0c0', fontFamily: '"Fira Mono", monospace', fontSize: '1.05rem', lineHeight: '1.5' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                <span style={{ color: '#00ffcc', fontWeight: 'bold' }}>[01]</span>
                <span><strong>WEBCAM TRACKING:</strong> This experience uses real-time computer vision. Move your hands in front of your camera to steer the glowing screen cursors.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                <span style={{ color: '#00ffcc', fontWeight: 'bold' }}>[02]</span>
                <span><strong>GESTURE CONTROL:</strong> Bring your index finger and thumb together to <strong>PINCH</strong>. Use this gesture to grab and drag interactive elements.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                <span style={{ color: '#00ffcc', fontWeight: 'bold' }}>[03]</span>
                <span><strong>DATA ARTIFACTS:</strong> The floating glass cubes represent my project portfolio. Grab a cube and drag it to the central execution port to open it.</span>
              </div>
            </div>
          </div>

          <div className="pulse-text" style={{ color: '#00ffcc', fontFamily: '"Fira Mono", monospace', fontSize: '1.1rem', letterSpacing: '4px', marginTop: '2vh' }}>
            &gt;&gt; PINCH AND DRAG THE ZIPPER BELOW TO UNLOCK &lt;&lt;
          </div>

        </div>
        <div style={{ position: 'absolute', top: '75%', left: '35%', width: '30%', height: '2px', borderBottom: '2px dotted #00ffcc', transform: 'translateY(-50%)', opacity: 0.5 }} />
        <div id="zipper-handle" style={{ position: 'absolute', top: '75%', left: 0, width: '60px', height: '20px', display: 'flex', alignItems: 'center', transform: 'translate(35vw, -50%)', marginLeft: '-30px' }}>
          <div style={{ width: '30px', height: '24px', backgroundColor: '#fff', borderRadius: '4px', boxShadow: '0 0 15px #00ffcc' }} />
          <div style={{ width: '30px', height: '10px', backgroundColor: 'rgba(0,255,204,0.3)', border: '1px solid #00ffcc' }} />
        </div>
      </div>

      {phase === 'main' && (
        <div id="execute-label" style={{ 
          position: 'absolute', 
          left: state.current.holeCurrX, 
          top: state.current.holeCurrY + 165, 
          transform: 'translateX(-50%)', 
          color: '#00ffcc', 
          fontFamily: '"Fira Mono", monospace', 
          fontSize: '0.95rem',
          fontWeight: 'bold', 
          letterSpacing: '4px',
          transition: 'opacity 0.3s',
          backgroundColor: 'rgba(5, 10, 15, 0.6)',
          padding: '12px 28px',
          border: '1px solid rgba(0, 255, 204, 0.4)',
          borderRadius: '30px',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 0 20px rgba(0, 255, 204, 0.15)',
          textShadow: '0 0 10px rgba(0, 255, 204, 0.8)'
        }}>
          [ DRAG CUBE HERE TO INITIALIZE ]
        </div>
      )}

      {expandedProject && expandedProject.id !== 'p3' && (
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 250, filter: 'drop-shadow(0 0 10px #00ffcc)' }}>
          <defs>
            <linearGradient id="web-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00ffcc" stopOpacity="1" />
              <stop offset="100%" stopColor="#00ffcc" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {[1, 2, 3, 4, 5].map(i => (
            <g key={i}>
              <path id={`tether-path-${i}`} className="data-tether-base" stroke="url(#web-gradient)" fill="none" />
              <path id={`tether-path-${i}-balls`} className={i % 2 === 0 ? "data-balls-fast" : "data-balls"} stroke="#ffffff" strokeWidth={i % 2 === 0 ? "6" : "4"} fill="none" />
            </g>
          ))}
        </svg>
      )}

      {expandedProject && (
        <div style={{ 
          position: 'absolute', 
          top: '15%', 
          right: '5%', 
          left: 'auto',
          transform: 'none', 
          width: '60vw', 
          height: '70vh', 
          backgroundColor: expandedProject.id === 'p3' ? 'transparent' : 'rgba(5, 10, 15, 0.85)', 
          borderRadius: '16px', 
          border: expandedProject.id === 'p3' ? 'none' : '1px solid rgba(0, 255, 204, 0.5)', 
          boxShadow: expandedProject.id === 'p3' ? 'none' : '0 0 80px rgba(0, 255, 204, 0.2)', 
          backdropFilter: expandedProject.id === 'p3' ? 'none' : 'blur(20px)', 
          zIndex: 300, 
          display: 'flex', 
          flexDirection: 'column', 
          animation: 'fadeIn 0.3s ease-out' 
        }}>
          <div ref={topBarRef} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 25px', borderBottom: expandedProject.id === 'p3' ? 'none' : '1px solid rgba(0, 255, 204, 0.2)', backgroundColor: expandedProject.id === 'p3' ? 'rgba(255, 0, 255, 0.15)' : 'rgba(0, 255, 204, 0.05)', border: expandedProject.id === 'p3' ? '1px solid #ff00ff' : 'none', borderRadius: expandedProject.id === 'p3' ? '16px' : '16px 16px 0 0', backdropFilter: 'blur(10px)', pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: expandedProject.id === 'p3' ? '#ff00ff' : '#00ffcc', boxShadow: `0 0 15px ${expandedProject.id === 'p3' ? '#ff00ff' : '#00ffcc'}` }} />
              <span style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: '1.4rem', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>
                {expandedProject.id === 'p3' ? 'SPATIAL DRIVE' : expandedProject.title}
              </span>
            </div>
            <div style={{ color: expandedProject.id === 'p3' ? '#ff00ff' : '#00ffcc', fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold' }}>
              ::: CLOSE BY DRAGGING THE CUBE BACK TO ITS INITIAL SPOT! :::
            </div>
          </div>
          
          {expandedProject.id !== 'p3' && (
            <div style={{ flex: 1, padding: '15px', pointerEvents: 'auto' }}>
              <iframe src={expandedProject.url} style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', backgroundColor: '#fff' }} title={expandedProject.title} />
            </div>
          )}
          
          {expandedProject.id === 'p3' && (
            <div style={{ color: 'rgb(255, 0, 255)', fontFamily: 'monospace', textAlign: 'right', marginTop: '30px', marginRight: '40px', textShadow: '0 0 10px #ff00ff' }}>
              <h2 style={{ letterSpacing: '3px' }}>[ RIGHT-HANDED DRIVE SYSTEM ACTIVE ]</h2>
              <p style={{ fontSize: '1.2rem' }}><b>GAS:</b> Open Palm</p>
              <p style={{ fontSize: '1.2rem' }}><b>STEER:</b> Move hand left/right</p>
              <p style={{ fontSize: '1.2rem' }}><b>BRAKE/REVERSE:</b> Closed Fist</p>
            </div>
          )}
        </div>
      )}

      <div ref={cursor1Ref} style={cursorStyle} />
      <div ref={cursor2Ref} style={cursorStyle} />
    </div>
  );
};

const cursorStyle = { position: 'absolute', width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', transformOrigin: 'center', marginLeft: '-10px', marginTop: '-10px', boxShadow: '0 0 15px #00ffcc', zIndex: 1000, opacity: 0, transition: 'background-color 0.2s' };

export default PortfolioUI;