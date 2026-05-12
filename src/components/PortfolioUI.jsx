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

        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate(${indexX}px, ${indexY}px)`;
        }

        const pinchDist = Math.hypot(thumbX - indexX, thumbY - indexY);
        const handIsPinching = pinchDist < 40;

        if (cursorRef.current) {
          cursorRef.current.style.backgroundColor = handIsPinching ? '#00ffcc' : 'white';
        }

        if (handIsPinching) {
          isPinching = true;
          activePinchX = indexX;
          activePinchY = indexY;
        }
      };

      if (hands[0]) processHand(hands[0], cursor1Ref);
      if (hands[1]) processHand(hands[1], cursor2Ref);

      const buttonEl = buttonRef.current;
      const dropZoneEl = dropZoneRef.current;

      if (buttonEl && dropZoneEl) {
        const btnRect = buttonEl.getBoundingClientRect();
        const dropRect = dropZoneEl.getBoundingClientRect();

        // Calculate the exact center of the Drop Zone
        const dropCenterX = dropRect.left + dropRect.width / 2;
        const dropCenterY = dropRect.top + dropRect.height / 2;

        const isHoveringBtn = activePinchX !== null &&
          activePinchX > btnRect.left && activePinchX < btnRect.right &&
          activePinchY > btnRect.top && activePinchY < btnRect.bottom;

        if (isPinching && isHoveringBtn && !state.current.isDragging) {
          state.current.isDragging = true;
        }

        let isMagnetized = false;

        if (state.current.isDragging) {
          if (isPinching) {
            // --- NEW: MAGNETIC SNAP LOGIC ---
            // How far is the dragged button from the drop zone?
            const distToDrop = Math.hypot(activePinchX - dropCenterX, activePinchY - dropCenterY);

            if (distToDrop < 150) { // The "Gravity Well" radius (150px)
              // Snap the button perfectly to the center of the zone
              state.current.buttonCurrentPos.x = dropCenterX - btnRect.width / 2;
              state.current.buttonCurrentPos.y = dropCenterY - btnRect.height / 2;
              isMagnetized = true;
            } else {
              // Follow the finger normally
              state.current.buttonCurrentPos.x = activePinchX - btnRect.width / 2;
              state.current.buttonCurrentPos.y = activePinchY - btnRect.height / 2;
            }
          } else {
            // Dropped!
            state.current.isDragging = false;
            
            // If we let go while inside the magnetic radius, it counts as a success!
            const distToDrop = Math.hypot(
              (state.current.buttonCurrentPos.x + btnRect.width / 2) - dropCenterX,
              (state.current.buttonCurrentPos.y + btnRect.height / 2) - dropCenterY
            );

            if (distToDrop < 100) {
              alert("Project Launched!");
            }
            state.current.buttonCurrentPos = { ...state.current.buttonOriginalPos };
            isMagnetized = false; // Reset visual state
          }
        }

        // --- NEW: VISUAL FEEDBACK FOR DROP ZONE ---
        if (isMagnetized) {
          dropZoneEl.style.transform = 'translateX(-50%) scale(1.1)'; // Make it bulge
          dropZoneEl.style.backgroundColor = 'rgba(0, 255, 204, 0.4)'; // Make it glow brighter
          dropZoneEl.style.boxShadow = '0 0 30px rgba(0, 255, 204, 0.8)';
        } else {
          dropZoneEl.style.transform = 'translateX(-50%) scale(1)';
          dropZoneEl.style.backgroundColor = 'rgba(0, 255, 204, 0.1)';
          dropZoneEl.style.boxShadow = 'none';
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