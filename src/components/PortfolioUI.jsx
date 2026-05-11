import React, { useEffect, useRef } from 'react';

const PortfolioUI = ({ handsPositionRef }) => {
  const cursorRef = useRef(null);
  const buttonRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Application State stored in refs to prevent React lag
  const state = useRef({
    isDragging: false,
    buttonOriginalPos: { x: 50, y: window.innerHeight / 2 },
    buttonCurrentPos: { x: 50, y: window.innerHeight / 2 }
  });

  useEffect(() => {
    let animationFrameId;

    const updateLoop = () => {
      if (!handsPositionRef.current?.landmarks || handsPositionRef.current.landmarks.length === 0) {
        if (cursorRef.current) cursorRef.current.style.opacity = 0;
        animationFrameId = requestAnimationFrame(updateLoop);
        return;
      }

      // 1. Get the first hand on screen
      const hand = handsPositionRef.current.landmarks[0];
      const thumb = hand[4];
      const index = hand[8];

      // 2. Map ML coordinates (0 to 1) to Screen Pixels
      // (Remember we invert X because the camera is mirrored!)
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      
      const thumbX = (1 - thumb.x) * screenW;
      const thumbY = thumb.y * screenH;
      const indexX = (1 - index.x) * screenW;
      const indexY = index.y * screenH;

      // 3. The Cursor: Midpoint between thumb and index
      const cursorX = (thumbX + indexX) / 2;
      const cursorY = (thumbY + indexY) / 2;

      // Move the visual cursor
      if (cursorRef.current) {
        cursorRef.current.style.opacity = 1;
        cursorRef.current.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
      }

      // 4. The Pinch: Distance between thumb and index
      const pinchDist = Math.hypot(thumbX - indexX, thumbY - indexY);
      const isPinching = pinchDist < 40; // If fingers are closer than 40px, it's a pinch!

      // Update cursor color based on pinch
      if (cursorRef.current) cursorRef.current.style.backgroundColor = isPinching ? '#00ffcc' : 'white';

      // 5. Hitbox Detection & Drag Logic
      const buttonEl = buttonRef.current;
      const dropZoneEl = dropZoneRef.current;

      if (buttonEl && dropZoneEl) {
        const btnRect = buttonEl.getBoundingClientRect();
        const dropRect = dropZoneEl.getBoundingClientRect();

        // Check if cursor is hovering over the button
        const isHoveringBtn = 
          cursorX > btnRect.left && cursorX < btnRect.right &&
          cursorY > btnRect.top && cursorY < btnRect.bottom;

        if (isPinching && isHoveringBtn && !state.current.isDragging) {
          // Grab the button!
          state.current.isDragging = true;
        }

        if (state.current.isDragging) {
          if (isPinching) {
            // Dragging: Move button to cursor
            state.current.buttonCurrentPos.x = cursorX - btnRect.width / 2;
            state.current.buttonCurrentPos.y = cursorY - btnRect.height / 2;
          } else {
            // Dropped!
            state.current.isDragging = false;

            // Did we drop it in the zone?
            const isHoveringDropZone = 
              cursorX > dropRect.left && cursorX < dropRect.right &&
              cursorY > dropRect.top && cursorY < dropRect.bottom;

            if (isHoveringDropZone) {
              // SUCCESS! TRIGGER ACTION HERE
              alert("Project Launched! (You can replace this with window.open)");
              // Reset button position
              state.current.buttonCurrentPos = { ...state.current.buttonOriginalPos };
            } else {
              // Missed the zone, snap back to origin
              state.current.buttonCurrentPos = { ...state.current.buttonOriginalPos };
            }
          }
        }

        // Apply the button position to the screen
        buttonEl.style.transform = `translate(${state.current.buttonCurrentPos.x}px, ${state.current.buttonCurrentPos.y}px)`;
      }

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    // Start the physics loop
    updateLoop();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 100 }}>
      
      {/* The Target Drop Zone (Bottom Center) */}
      <div 
        ref={dropZoneRef}
        style={{
          position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
          width: '200px', height: '100px', border: '3px dashed #00ffcc', borderRadius: '15px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#00ffcc', fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: '1.2rem',
          backgroundColor: 'rgba(0, 255, 204, 0.1)'
        }}>
        DROP HERE
      </div>

      {/* The Draggable Project Button */}
      <div 
        ref={buttonRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '120px', height: '60px', backgroundColor: '#fff', borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#000', fontFamily: 'sans-serif', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(255,255,255,0.2)',
          transition: state.current.isDragging ? 'none' : 'transform 0.3s ease-out' // Smooth snap-back
        }}>
        Project 1
      </div>

      {/* The Visual Pinch Cursor */}
      <div 
        ref={cursorRef}
        style={{
          position: 'absolute', top: 0, left: 0, width: '20px', height: '20px',
          backgroundColor: 'white', borderRadius: '50%', transformOrigin: 'center',
          marginLeft: '-10px', marginTop: '-10px', transition: 'background-color 0.1s',
          boxShadow: '0 0 10px rgba(0, 255, 204, 0.8)'
        }} 
      />
    </div>
  );
};

export default PortfolioUI;