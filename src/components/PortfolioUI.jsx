import React, { useEffect, useRef } from 'react';

const PortfolioUI = ({ handsPositionRef }) => {
  // We now have TWO cursors
  const cursor1Ref = useRef(null);
  const cursor2Ref = useRef(null);
  const buttonRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Moved button original position closer to the center (25% across, 30% down)
  const safeOriginalPos = { x: window.innerWidth * 0.25, y: window.innerHeight * 0.3 };

  const state = useRef({
    isDragging: false,
    buttonOriginalPos: { ...safeOriginalPos },
    buttonCurrentPos: { ...safeOriginalPos }
  });

  useEffect(() => {
    let animationFrameId;

    const updateLoop = () => {
      const hands = handsPositionRef.current?.landmarks || [];
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;

      // Reset cursors if hands are missing
      if (cursor1Ref.current) cursor1Ref.current.style.opacity = hands[0] ? 1 : 0;
      if (cursor2Ref.current) cursor2Ref.current.style.opacity = hands[1] ? 1 : 0;

      let activePinchX = null;
      let activePinchY = null;
      let isPinching = false;

      // Helper function to process a hand
      const processHand = (hand, cursorRef) => {
        const thumb = hand[4];
        const index = hand[8];

        const thumbX = (1 - thumb.x) * screenW;
        const thumbY = thumb.y * screenH;
        const indexX = (1 - index.x) * screenW;
        const indexY = index.y * screenH;

        // Lock to index finger
        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate(${indexX}px, ${indexY}px)`;
        }

        const pinchDist = Math.hypot(thumbX - indexX, thumbY - indexY);
        const handIsPinching = pinchDist < 40;

        if (cursorRef.current) {
          cursorRef.current.style.backgroundColor = handIsPinching ? '#00ffcc' : 'white';
        }

        // If this hand is pinching, set it as the active controller
        if (handIsPinching) {
          isPinching = true;
          activePinchX = indexX;
          activePinchY = indexY;
        }
      };

      // Process Hand 1 and Hand 2
      if (hands[0]) processHand(hands[0], cursor1Ref);
      if (hands[1]) processHand(hands[1], cursor2Ref);

      // --- DRAG LOGIC ---
      const buttonEl = buttonRef.current;
      const dropZoneEl = dropZoneRef.current;

      if (buttonEl && dropZoneEl) {
        const btnRect = buttonEl.getBoundingClientRect();
        const dropRect = dropZoneEl.getBoundingClientRect();

        // Check hover using the ACTIVE pinching hand
        const isHoveringBtn = activePinchX !== null &&
          activePinchX > btnRect.left && activePinchX < btnRect.right &&
          activePinchY > btnRect.top && activePinchY < btnRect.bottom;

        if (isPinching && isHoveringBtn && !state.current.isDragging) {
          state.current.isDragging = true;
        }

        if (state.current.isDragging) {
          if (isPinching) {
            // Drag the button with whoever is pinching
            state.current.buttonCurrentPos.x = activePinchX - btnRect.width / 2;
            state.current.buttonCurrentPos.y = activePinchY - btnRect.height / 2;
          } else {
            // Dropped!
            state.current.isDragging = false;
            
            // Check Drop Zone
            // We use the center of the button to check the drop zone, not the finger
            const btnCenterX = state.current.buttonCurrentPos.x + btnRect.width / 2;
            const btnCenterY = state.current.buttonCurrentPos.y + btnRect.height / 2;

            const isHoveringDropZone = 
              btnCenterX > dropRect.left && btnCenterX < dropRect.right &&
              btnCenterY > dropRect.top && btnCenterY < dropRect.bottom;

            if (isHoveringDropZone) {
              alert("Project Launched!");
            }
            // Always snap back after dropping
            state.current.buttonCurrentPos = { ...state.current.buttonOriginalPos };
          }
        }

        buttonEl.style.transform = `translate(${state.current.buttonCurrentPos.x}px, ${state.current.buttonCurrentPos.y}px)`;
      }

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    updateLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 100 }}>
      
      {/* Drop Zone: Brought up to 25% from bottom instead of hard to reach edge */}
      <div ref={dropZoneRef} style={{
          position: 'absolute', bottom: '25%', left: '50%', transform: 'translateX(-50%)',
          width: '240px', height: '120px', border: '3px dashed #00ffcc', borderRadius: '15px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#00ffcc', fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: '1.5rem',
          backgroundColor: 'rgba(0, 255, 204, 0.1)', backdropFilter: 'blur(5px)'
        }}>
        DROP HERE
      </div>

      {/* Button: Starts in the top left "Safe Zone" */}
      <div ref={buttonRef} style={{
          position: 'absolute', top: 0, left: 0,
          width: '140px', height: '70px', backgroundColor: '#fff', borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#000', fontFamily: 'sans-serif', fontWeight: 'bold', fontSize: '1.2rem',
          boxShadow: '0 4px 15px rgba(255,255,255,0.2)',
          transition: state.current.isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' // Bouncy snap back
        }}>
        Project 1
      </div>

      {/* Cursor 1 (Right Hand usually) */}
      <div ref={cursor1Ref} style={cursorStyle} />
      {/* Cursor 2 (Left Hand usually) */}
      <div ref={cursor2Ref} style={cursorStyle} />
    </div>
  );
};

// Reusable styling for the cursors
const cursorStyle = {
  position: 'absolute', top: 0, left: 0, width: '20px', height: '20px',
  backgroundColor: 'white', borderRadius: '50%', transformOrigin: 'center',
  marginLeft: '-10px', marginTop: '-10px', transition: 'background-color 0.1s',
  boxShadow: '0 0 15px rgba(0, 255, 204, 1)'
};

export default PortfolioUI;