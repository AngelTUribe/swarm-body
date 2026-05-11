import { useEffect, useRef } from 'react';

export const usePoseDetection = (videoRef, nosePositionRef) => {
  const poseRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const pose = new window.Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    pose.setOptions({
      modelComplexity: 1, 
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

   pose.onResults((results) => {
      if (results.poseLandmarks && nosePositionRef.current) {
        nosePositionRef.current.landmarks = results.poseLandmarks;
      }
    });

    poseRef.current = pose;

    let animationFrameId;
    const processVideo = async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        await pose.send({ image: videoRef.current });
      }
      animationFrameId = requestAnimationFrame(processVideo);
    };

    videoRef.current.addEventListener('loadeddata', processVideo);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (poseRef.current) poseRef.current.close();
    };
  }, [videoRef, nosePositionRef]); 
};