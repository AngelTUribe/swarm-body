import React, { useEffect, useRef, useState } from 'react';

// 1. Add 'url' to your projects (Use real links to your deployed projects later!)
const PROJECTS = [
  { id: 'p1', title: 'React Dashboard', subtitle: 'Web Dev', url: 'https://example.com' },
  { id: 'p2', title: 'Swarm Body', subtitle: 'Creative Coding', url: 'https://example.com' },
  { id: 'p3', title: 'AI Agent', subtitle: 'Machine Learning', url: 'https://example.com' },
];

const PortfolioUI = ({ handsPositionRef }) => {
  const cursor1Ref = useRef(null);
  const cursor2Ref = useRef(null);
  const dropZoneRef = useRef(null);
  const closeBtnRef = useRef(null); // Ref for the holographic close button
  const projectRefs = useRef({});

  // React state to handle the UI rendering of the expanded window
  const [expandedProject, setExpandedProject] = useState(null);
  const [mounted, setMounted] = useState(false);

  const state = useRef({
    draggedId: null,
    isExpanded: false, // Tells the physics loop if a window is open
    wasPinching: false, // Helps prevent double-clicks
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
      const x = centerX + radius * Math.cos(rad) - 75; 
      const y = centerY + radius * Math.sin(rad) - 40; 
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

      let activePinchX = null;
      let activePinchY = null;
      let isPinching = false;

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

        if (cursorRef.current) {
          // If a window is open, make the cursor red to show it's a "Close/Click" cursor
          cursorRef.current.style.backgroundColor = handIsPinching ? (state.current.isExpanded ? '#ff0055' : '#00ffcc') : 'white';
        }

        if (handIsPinching) {
          isPinching = true;
          activePinchX = indexX;
          activePinchY = indexY;
        }
      };

      if (hands[0]) processHand(hands[0], cursor1Ref);
      if (hands[1]) processHand(hands[1], cursor2Ref);

      // --- NEW: IF A PROJECT IS EXPANDED, ONLY CHECK THE CLOSE BUTTON ---
      if (state.current.isExpanded) {
        if (isPinching && !state.current.wasPinching && closeBtnRef.current) {
          const rect = closeBtnRef.current.getBoundingClientRect();
          if (activePinchX > rect.left && activePinchX < rect.right &&
              activePinchY > rect.top && activePinchY < rect.bottom) {
            // They pinched the close button!
            setExpandedProject(null);
            state.current.isExpanded = false;
          }
        }
        state.current.wasPinching = isPinching;
        animationFrameId = requestAnimationFrame(updateLoop);
        return; // Skip the rest of the dragging logic
      }

      // --- STANDARD DRAG LOGIC ---
      const dropZoneEl = dropZoneRef.current;

      if (dropZoneEl) {
        const dropRect = dropZoneEl.getBoundingClientRect();
        const dropCenterX = dropRect.left + dropRect.width / 2;
        const dropCenterY = dropRect.top + dropRect.height / 2;

        if (!state.current.draggedId && isPinching && activePinchX !== null) {
          for (let p of PROJECTS) {
            const el = projectRefs.current[p.id];
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            
            if (activePinchX > rect.left && activePinchX < rect.right &&
                activePinchY > rect.top && activePinchY < rect.bottom) {
              state.current.draggedId = p.id;
              break; 
            }
          }
        }

        let isMagnetized = false;

        if (state.current.draggedId) {
          const pid = state.current.draggedId;
          const pState = state.current.projects[pid];
          const el = projectRefs.current[pid];
          const btnWidth = 150;
          const btnHeight = 80;

          if (isPinching) {
            const distToDrop = Math.hypot(activePinchX - dropCenterX, activePinchY - dropCenterY);

            if (distToDrop < 150) {
              pState.currX = dropCenterX - btnWidth / 2;
              pState.currY = dropCenterY - btnHeight / 2;
              isMagnetized = true;
            } else {
              pState.currX = activePinchX - btnWidth / 2;
              pState.currY = activePinchY - btnHeight / 2;
            }
            el.style.zIndex = 200;
          } else {
            // Dropped!
            state.current.draggedId = null;
            el.style.zIndex = 10;
            
            const distToDrop = Math.hypot(
              (pState.currX + btnWidth / 2) - dropCenterX,
              (pState.currY + btnHeight / 2) - dropCenterY
            );

            if (distToDrop < 100) {
              // --- NEW: EXPAND THE PROJECT ---
              const droppedProject = PROJECTS.find(p => p.id === pid);
              setExpandedProject(droppedProject);
              state.current.isExpanded = true;
            }
            
            pState.currX = pState.origX;
            pState.currY = pState.origY;
            isMagnetized = false;
          }
        }

        if (isMagnetized) {
          dropZoneEl.style.transform = 'translateX(-50%) scale(1.1)';
          dropZoneEl.style.backgroundColor = 'rgba(0, 255, 204, 0.4)';
          dropZoneEl.style.boxShadow = '0 0 30px rgba(0, 255, 204, 0.8)';
        } else {
          dropZoneEl.style.transform = 'translateX(-50%) scale(1)';
          dropZoneEl.style.backgroundColor = 'rgba(0, 255, 204, 0.1)';
          dropZoneEl.style.boxShadow = 'none';
        }

        PROJECTS.forEach(p => {
          const el = projectRefs.current[p.id];
          const pState = state.current.projects[p.id];
          if (el && pState) {
            el.style.transform = `translate(${pState.currX}px, ${pState.currY}px)`;
            el.style.transition = state.current.draggedId === p.id ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            // Hide cards if a project is expanded
            el.style.opacity = state.current.isExpanded ? 0 : 1;
            el.style.pointerEvents = state.current.isExpanded ? 'none' : 'auto';
          }
        });
        
        // Hide drop zone if expanded
        dropZoneEl.style.opacity = state.current.isExpanded ? 0 : 1;
      }

      state.current.wasPinching = isPinching;
      animationFrameId = requestAnimationFrame(updateLoop);
    };

    updateLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 100 }}>
      
      <div ref={dropZoneRef} style={{
          position: 'absolute', bottom: '20%', left: '50%', transform: 'translateX(-50%)',
          width: '240px', height: '120px', border: '2px dashed rgba(0, 255, 204, 0.6)', borderRadius: '15px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#00ffcc', fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: '2px',
          backgroundColor: 'rgba(0, 255, 204, 0.05)', backdropFilter: 'blur(5px)', transition: 'all 0.2s ease-out'
        }}>
        [ DROP PROJECT ]
      </div>

      {PROJECTS.map(project => (
        <div key={project.id} ref={el => projectRefs.current[project.id] = el} 
          style={{
            position: 'absolute', top: 0, left: 0, width: '150px', height: '80px', borderRadius: '12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'sans-serif', color: '#fff', background: 'rgba(10, 20, 30, 0.7)',
            border: '1px solid rgba(0, 255, 204, 0.3)', boxShadow: '0 8px 32px rgba(0, 255, 204, 0.1)',
            backdropFilter: 'blur(10px)', zIndex: 10, transition: 'opacity 0.3s ease-out'
          }}>
          <span style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '4px' }}>{project.title}</span>
          <span style={{ fontSize: '0.75rem', color: '#00ffcc' }}>{project.subtitle}</span>
        </div>
      ))}

      {/* --- NEW: THE EXPANDED PROJECT MODAL --- */}
      {expandedProject && (
        <div style={{
          position: 'absolute', top: '10%', left: '10%', width: '80%', height: '80%',
          backgroundColor: 'rgba(5, 10, 15, 0.85)', borderRadius: '20px',
          border: '1px solid #00ffcc', boxShadow: '0 0 50px rgba(0, 255, 204, 0.3)',
          backdropFilter: 'blur(15px)', zIndex: 300, display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {/* Top Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 20px', borderBottom: '1px solid rgba(0, 255, 204, 0.3)' }}>
            <span style={{ color: '#00ffcc', fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 'bold' }}>
              {expandedProject.title}
            </span>
            
            {/* Holographic Close Button */}
            <div ref={closeBtnRef} style={{
              width: '100px', height: '40px', backgroundColor: 'rgba(255, 0, 85, 0.2)',
              border: '1px solid #ff0055', borderRadius: '8px', color: '#ff0055',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: '1.1rem',
              boxShadow: '0 0 15px rgba(255, 0, 85, 0.4)'
            }}>
              PINCH TO CLOSE
            </div>
          </div>

          {/* Iframe Content */}
          <div style={{ flex: 1, padding: '10px' }}>
             {/* pointerEvents: 'auto' allows normal mouse scrolling/clicking inside the iframe! */}
            <iframe 
              src={expandedProject.url} 
              style={{ width: '100%', height: '100%', border: 'none', borderRadius: '10px', pointerEvents: 'auto' }}
              title={expandedProject.title}
            />
          </div>
        </div>
      )}

      {/* Hand Trackers */}
      <div ref={cursor1Ref} style={{ ...cursorStyle, zIndex: 999 }} />
      <div ref={cursor2Ref} style={{ ...cursorStyle, zIndex: 999 }} />
    </div>
  );
};

const cursorStyle = {
  position: 'absolute', top: 0, left: 0, width: '20px', height: '20px',
  backgroundColor: 'white', borderRadius: '50%', transformOrigin: 'center',
  marginLeft: '-10px', marginTop: '-10px', transition: 'background-color 0.1s',
  boxShadow: '0 0 15px rgba(0, 255, 204, 1)'
};

export default PortfolioUI;