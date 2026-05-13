import React, { useEffect, useRef, useState } from 'react';

const DJCenter = ({ handsPositionRef }) => {
  const [audioLoaded, setAudioLoaded] = useState(false);
  const audioCtxRef = useRef(null);
  const audioElRef = useRef(null);
  const trackRef = useRef(null);
  const gainNodeRef = useRef(null);
  
  // UI Refs for animation
  const volumeBarRef = useRef(null);
  const recordRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);

  // 1. SETUP WEB AUDIO API
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    const url = URL.createObjectURL(file);
    if (!audioElRef.current) {
      audioElRef.current = new Audio(url);
      audioElRef.current.loop = true;
      
      trackRef.current = audioCtxRef.current.createMediaElementSource(audioElRef.current);
      gainNodeRef.current = audioCtxRef.current.createGain();
      
      trackRef.current.connect(gainNodeRef.current).connect(audioCtxRef.current.destination);
    } else {
      audioElRef.current.src = url;
    }
    
    setAudioLoaded(true);
  };

  const togglePlay = () => {
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    
    if (isPlaying) {
      audioElRef.current.pause();
    } else {
      audioElRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // 2. THE SPATIAL AUDIO LOOP
  useEffect(() => {
    let animationFrameId;

    const djLoop = () => {
      if (!audioLoaded || !audioElRef.current) {
        animationFrameId = requestAnimationFrame(djLoop);
        return;
      }

      const hands = handsPositionRef.current?.landmarks || [];
      const screenH = window.innerHeight;
      const screenW = window.innerWidth;

      // Map Left Hand (index 0) to Volume
      if (hands[0]) {
        const indexY = hands[0][8].y; // Normalized Y (0.0 to 1.0)
        
        // Invert Y so up is louder, down is quieter
        let volume = 1.0 - indexY; 
        volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
        
        // Smoothly adjust audio node
        if (gainNodeRef.current) {
           gainNodeRef.current.gain.setTargetAtTime(volume, audioCtxRef.current.currentTime, 0.1);
        }
        
        // Update UI Visuals
        if (volumeBarRef.current) {
          volumeBarRef.current.style.height = `${volume * 100}%`;
        }
      }

      // Map Right Hand (index 1) to Scratching
      if (hands[1]) {
        const thumbX = (1 - hands[1][4].x) * screenW;
        const indexX = (1 - hands[1][8].x) * screenW;
        const thumbY = hands[1][4].y * screenH;
        const indexY = hands[1][8].y * screenH;
        
        const isPinching = Math.hypot(thumbX - indexX, thumbY - indexY) < 45;

        if (isPinching) {
          // If pinching, map the X position of the hand to the playback speed
          // Middle of screen = normal speed (1.0). Left = reverse/slow. Right = fast forward.
          const normalizedX = indexX / screenW; 
          const scratchRate = (normalizedX * 4) - 1.0; // Math to map 0->1 to -1.0->3.0
          
          audioElRef.current.playbackRate = Math.max(0.1, scratchRate); // Note: standard HTML5 audio struggles with true reverse, so we clamp above 0.
          
          // Spin the record UI
          if (recordRef.current) {
            recordRef.current.style.transform = `rotate(${normalizedX * 1000}deg)`;
          }
        } else {
          // Return to normal speed when let go
          audioElRef.current.playbackRate = 1.0;
          if (recordRef.current) {
            recordRef.current.style.transform = `rotate(${audioElRef.current.currentTime * 50}deg)`; // Normal spin
          }
        }
      } else {
         // Auto-spin if no right hand detected
         if (recordRef.current && isPlaying) {
           recordRef.current.style.transform = `rotate(${audioElRef.current.currentTime * 50}deg)`;
         }
      }

      animationFrameId = requestAnimationFrame(djLoop);
    };

    djLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [audioLoaded, isPlaying]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#00ffcc', fontFamily: 'monospace' }}>
      
      {!audioLoaded ? (
        <div style={{ border: '2px dashed #00ffcc', padding: '40px', borderRadius: '16px', textAlign: 'center' }}>
          <h2>INITIALIZE AUDIO DECK</h2>
          <input type="file" accept="audio/*" onChange={handleFileUpload} style={{ marginTop: '20px', color: '#fff' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', width: '100%', height: '100%', padding: '20px', gap: '40px' }}>
          
          {/* VOLUME FADER (Left Side) */}
          <div style={{ width: '60px', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid #00ffcc', borderRadius: '30px', position: 'relative', display: 'flex', alignItems: 'flex-end', padding: '5px' }}>
            <div ref={volumeBarRef} style={{ width: '100%', height: '50%', backgroundColor: '#00ffcc', borderRadius: '25px', transition: 'height 0.1s linear', boxShadow: '0 0 15px #00ffcc' }} />
            <span style={{ position: 'absolute', bottom: '-25px', left: '-5px' }}>VOL [L]</span>
          </div>

          {/* TURNTABLE (Center) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
             <div 
               ref={recordRef}
               style={{ 
                 width: '250px', height: '250px', borderRadius: '50%', border: '4px solid #333', 
                 backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center',
                 boxShadow: '0 0 30px rgba(0, 255, 204, 0.2)'
               }}
             >
                {/* Record Label */}
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#00ffcc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <div style={{ width: '15px', height: '15px', backgroundColor: '#111', borderRadius: '50%' }} />
                </div>
             </div>
             
             <p style={{ marginTop: '30px', textAlign: 'center' }}>
               Use <b>Left Hand</b> (Up/Down) for Volume.<br/>
               <b>Pinch & Drag Right Hand</b> (Left/Right) to Scratch.
             </p>

             <button 
               onClick={togglePlay} 
               style={{ marginTop: '20px', padding: '10px 30px', backgroundColor: 'transparent', border: '2px solid #00ffcc', color: '#00ffcc', fontSize: '1.2rem', borderRadius: '8px', cursor: 'pointer' }}
             >
               {isPlaying ? 'PAUSE' : 'PLAY'}
             </button>
          </div>

        </div>
      )}
    </div>
  );
};

export default DJCenter;