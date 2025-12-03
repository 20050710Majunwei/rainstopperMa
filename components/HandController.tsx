import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { RainState } from '../types';

interface HandControllerProps {
  rainStateRef: React.MutableRefObject<RainState>;
  onReady: () => void;
}

export const HandController: React.FC<HandControllerProps> = ({ rainStateRef, onReady }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const requestRef = useRef<number>();
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);

  // Constants for gesture mapping
  const CONTROL_THRESHOLD = 0.5; // Confidence needed to take control

  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        startCamera();
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
        setCameraError("Failed to load AI model.");
      }
    };

    initMediaPipe();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", predictWebcam);
        onReady();
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setCameraError("Camera access denied. Please allow camera usage to control the rain.");
    }
  };

  const predictWebcam = () => {
    if (!handLandmarkerRef.current || !videoRef.current || !canvasRef.current) return;
    
    const startTimeMs = performance.now();
    const video = videoRef.current;
    
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      const results = handLandmarkerRef.current.detectForVideo(video, startTimeMs);
      
      // Draw Logic (Debug visualization on small canvas)
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Flip canvas horizontally for mirror effect
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        
        // Optional: Draw video feed
        // ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        if (results.landmarks) {
          const drawingUtils = new DrawingUtils(ctx);
          for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
              color: "#00FF00",
              lineWidth: 2
            });
            drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 1, radius: 3 });
          }
        }
        ctx.restore();
      }

      // --- Core Logic: Map Gesture to Rain Speed ---
      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // Use Wrist and Middle Finger Tip to determine position
        const wrist = landmarks[0];
        // const middleTip = landmarks[12];
        
        // Y coordinate in MediaPipe is 0 (top) to 1 (bottom)
        const yPos = wrist.y;
        
        // Let's assume Open Palm is the trigger. 
        // Simple check: Average distance of finger tips from wrist? 
        // For simplicity/robustness, we just use presence of hand to engage, 
        // and height to control speed.
        
        // Mapping:
        // Top (0.0 - 0.3) -> Reverse (-2.0)
        // Middle (0.4 - 0.6) -> Stop (0.0)
        // Bottom (0.7 - 1.0) -> Normal Fall (1.0)
        
        let targetSpeed = 1.0;
        let active = true;

        if (yPos < 0.3) {
          // Top zone: Ascend
          // Map 0.0 -> -3.0, 0.3 -> -0.5
          const t = yPos / 0.3; // 0 to 1
          targetSpeed = -2.0 + (t * 1.5); // Range -2.0 to -0.5
        } else if (yPos >= 0.3 && yPos <= 0.7) {
            // Middle zone: Slow / Stop
            // Center is 0.5. Map 0.3 -> -0.5, 0.5 -> 0, 0.7 -> 1.0
            // Actually, let's create a "dead zone" for pure stop
            if (yPos > 0.45 && yPos < 0.55) {
                targetSpeed = 0;
            } else {
                 // Transition zones
                 if (yPos <= 0.45) {
                     // 0.3 to 0.45 maps to -0.5 to 0
                     const t = (yPos - 0.3) / 0.15;
                     targetSpeed = -0.5 + (t * 0.5);
                 } else {
                     // 0.55 to 0.7 maps to 0 to 1.0
                     const t = (yPos - 0.55) / 0.15;
                     targetSpeed = t;
                 }
            }
        } else {
          // Bottom zone: Fall
          // 0.7 -> 1.0
          // 1.0 -> 2.0 (Fast fall)
          const t = (yPos - 0.7) / 0.3;
          targetSpeed = 1.0 + t;
        }
        
        // Lerp for smoothness
        const current = rainStateRef.current.speed;
        const alpha = 0.1; // Smoothing factor
        rainStateRef.current.speed = current + (targetSpeed - current) * alpha;
        rainStateRef.current.isActive = active;

      } else {
        // No hand detected, reset to gravity gradually
        const current = rainStateRef.current.speed;
        const target = 1.0;
        rainStateRef.current.speed = current + (target - current) * 0.05;
        rainStateRef.current.isActive = false;
      }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end pointer-events-none">
       {/* Debug View */}
      <div className="relative w-32 h-24 bg-black/50 border border-white/20 rounded overflow-hidden shadow-lg backdrop-blur-sm">
        <video 
          ref={videoRef} 
          className="absolute inset-0 w-full h-full object-cover opacity-60 mirror transform -scale-x-100" 
          playsInline 
          muted 
          autoPlay 
        />
        <canvas 
          ref={canvasRef}
          width={320}
          height={240}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
      {cameraError && (
        <div className="mt-2 text-red-400 bg-black/80 p-2 rounded text-xs max-w-[200px]">
            {cameraError}
        </div>
      )}
    </div>
  );
};
