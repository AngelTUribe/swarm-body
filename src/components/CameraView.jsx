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
    <div style={{ position: 'relative', width: '100%', margin: '0 auto' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          transform: 'scaleX(-1)', 
          borderRadius: '10px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}
      />
    </div>
  );
};

export default CameraView;