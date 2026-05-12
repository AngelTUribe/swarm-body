import React, { useEffect, useRef, useState } from 'react';

// 1. Define your projects here
const PROJECTS = [
  { id: 'p1', title: 'React Dashboard', subtitle: 'Web Dev' },
  { id: 'p2', title: 'Swarm Body', subtitle: 'Creative Coding' },
  { id: 'p3', title: 'AI Agent', subtitle: 'Machine Learning' },
];

const PortfolioUI = ({ handsPositionRef }) => {
  const cursor1Ref = useRef(null);
  const cursor2Ref = useRef(null);
  const dropZoneRef = useRef(null);
  
  // We use an object to store refs for multiple dynamically generated project cards
  const projectRefs = useRef({});

  // Centralized physics state
  const state = useRef({
    draggedId: null,
    projects: {} // Will hold { origX, origY, currX, currY } for each project
  });

  // Force a re-render once just to make sure DOM refs are attached
  const [mounted, setMounted] = useState(false);

  // 2. Calculate the Spatial Arc on load
  useEffect(() => {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    
    const centerX = screenW / 2;
    const centerY = screenH * 0.7; // The anchor point is low, so the arc goes over your head
    const radius = screenW * 0.35; // How wide the circle is

    // Angles for the 3 cards: Left, Center, Right (-40°, 0°, 40°)
    const angles = [-40, 0, 40]; 

    PROJECTS.forEach((p, index) => {
      // Convert degrees to radians (subtracting 90 so 0 degrees is straight UP)
      const rad = (angles[index] - 90) * (Math.PI / 180);
      
      // Arc Math!
      const x = centerX + radius * Math.cos(rad) - 75; // -75 centers the 150px wide card
      const y = centerY + radius * Math.sin(rad) - 40; // -40 centers the 80px tall card
      
      state.current.projects[p.id] = { origX: x, origY: y, currX: x, currY: y };
    });

    setMounted(true);
  }, []);

  // 3. The Multi-Hitbox Physics Loop
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

        if (cursorRef.current) cursorRef.current.style.backgroundColor = handIsPinching ? '#00ffcc' : 'white';

        if (handIsPinching) {
          isPinching = true;
          activePinchX = indexX;
          activePinchY = indexY;
        }
      };

      if (hands[0]) processHand(hands[0], cursor1Ref);
      if (hands[1]) processHand(hands[1], cursor2Ref);

      const dropZoneEl = dropZoneRef.current;

      if (dropZoneEl) {
        const dropRect = dropZoneEl.getBoundingClientRect();
        const dropCenterX = dropRect.left + dropRect.width / 2;
        const dropCenterY = dropRect.top + dropRect.height / 2;

        // A. If we aren't holding anything, check if we are grabbing a card
        if (!state.current.draggedId && isPinching && activePinchX !== null) {
          for (let p of PROJECTS) {
            const el = projectRefs.current[p.id];
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            
            if (activePinchX > rect.left && activePinchX < rect.right &&
                activePinchY > rect.top && activePinchY < rect.bottom) {
              state.current.draggedId = p.id;
              break; // Stop checking once we grab one!
            }
          }
        }

        // B. If we ARE holding a card, move it!
        let isMagnetized = false;

        if (state.current.draggedId) {
          const pid = state.current.draggedId;
          const pState = state.current.projects[pid];
          const el = projectRefs.current[pid];
          const btnWidth = 150;
          const btnHeight = 80;

          if (isPinching) {
            // Magnetic Drop Logic
            const distToDrop = Math.hypot(activePinchX - dropCenterX, activePinchY - dropCenterY);

            if (distToDrop < 150) {
              pState.currX = dropCenterX - btnWidth / 2;
              pState.currY = dropCenterY - btnHeight / 2;
              isMagnetized = true;
            } else {
              pState.currX = activePinchX - btnWidth / 2;
              pState.currY = activePinchY - btnHeight / 2;
            }
            
            // Bring dragged card to the very front
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
              alert(`Launched ${PROJECTS.find(p => p.id === pid).title}!`);
            }
            // Snap back to its exact spot in the Arc
            pState.currX = pState.origX;
            pState.currY = pState.origY;
            isMagnetized = false;
          }
        }

        // Apply visual glow to drop zone
        if (isMagnetized) {
          dropZoneEl.style.transform = 'translateX(-50%) scale(1.1)';
          dropZoneEl.style.backgroundColor = 'rgba(0, 255, 204, 0.4)';
          dropZoneEl.style.boxShadow = '0 0 30px rgba(0, 255, 204, 0.8)';
        } else {
          dropZoneEl.style.transform = 'translateX(-50%) scale(1)';
          dropZoneEl.style.backgroundColor = 'rgba(0, 255, 204, 0.1)';
          dropZoneEl.style.boxShadow = 'none';
        }

        // Apply DOM updates to all cards
        PROJECTS.forEach(p => {
          const el = projectRefs.current[p.id];
          const pState = state.current.projects[p.id];
          if (el && pState) {
            el.style.transform = `translate(${pState.currX}px, ${pState.currY}px)`;
            // Remove CSS transition while dragging so it feels perfectly attached to the finger
            el.style.transition = state.current.draggedId === p.id ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
          }
        });
      }

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    updateLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 100 }}>
      
      {/* The Magnetic Drop Zone */}
      <div ref={dropZoneRef} style={{
          position: 'absolute', bottom: '20%', left: '50%', transform: 'translateX(-50%)',
          width: '240px', height: '120px', border: '2px dashed rgba(0, 255, 204, 0.6)', borderRadius: '15px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#00ffcc', fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: '2px',
          backgroundColor: 'rgba(0, 255, 204, 0.05)', backdropFilter: 'blur(5px)',
          transition: 'all 0.2s ease-out'
        }}>
        [ DROP PROJECT ]
      </div>

      {/* Render The Spatial Arc Projects */}
      {PROJECTS.map(project => (
        <div 
          key={project.id}
          ref={el => projectRefs.current[project.id] = el} 
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '150px', height: '80px', borderRadius: '12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'sans-serif', color: '#fff',
            // Glassmorphism styling for futuristic AR vibe
            background: 'rgba(10, 20, 30, 0.7)',
            border: '1px solid rgba(0, 255, 204, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 255, 204, 0.1)',
            backdropFilter: 'blur(10px)',
            zIndex: 10
          }}>
          <span style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '4px' }}>{project.title}</span>
          <span style={{ fontSize: '0.75rem', color: '#00ffcc' }}>{project.subtitle}</span>
        </div>
      ))}

      {/* Hand Trackers */}
      <div ref={cursor1Ref} style={cursorStyle} />
      <div ref={cursor2Ref} style={cursorStyle} />
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