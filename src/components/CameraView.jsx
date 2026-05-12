import React, { useEffect, useRef } from 'react';
import { useHandDetection } from '../hooks/useHandDetection';

const CameraView = ({ handsPositionRef }) => {
  const videoRef = useRef(null);

  useHandDetection(videoRef, handsPositionRef); 

  useEffect(() => {
    async function setupCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Your browser does not support webcam access.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing the webcam: ", err);
      }
    }
    setupCamera();
  }, []);

  return (
    // We removed the PIP styling and made it full screen
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0 }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'fill', // Stretches to fill monitor
          transform: 'scaleX(-1)', // Mirrored
          opacity: 0.3 // Dimmed so the 3D hologram still glows!
        }}
      />
    </div>
  );
};

export default CameraView;