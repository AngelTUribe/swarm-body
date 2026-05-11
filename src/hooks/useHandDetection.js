import { useEffect, useRef } from 'react';

export const useHandDetection = (videoRef, handsPositionRef) => {
  const handsModelRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;

    // 1. Initialize the Hands model
    const hands = new window.Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    hands.setOptions({
      maxNumHands: 2, // Track up to 2 hands at once
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    // 2. Save the hand data
    hands.onResults((results) => {
      if (handsPositionRef.current) {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          // This gives us an array of hands. Each hand has 21 joint coordinates!
          handsPositionRef.current.landmarks = results.multiHandLandmarks;
        } else {
          // If hands leave the screen, clear the data so the swarm stops
          handsPositionRef.current.landmarks = [];
        }
      }
    });

    handsModelRef.current = hands;

    let animationFrameId;
    const processVideo = async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        await hands.send({ image: videoRef.current });
      }
      animationFrameId = requestAnimationFrame(processVideo);
    };

    videoRef.current.addEventListener('loadeddata', processVideo);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (handsModelRef.current) handsModelRef.current.close();
    };
  }, [videoRef, handsPositionRef]);
};