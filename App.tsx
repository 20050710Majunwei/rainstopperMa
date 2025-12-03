import React, { useRef, useState } from 'react';
import { RainScene } from './components/RainScene';
import { HandController } from './components/HandController';
import { RainState } from './types';

const App: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Mutable ref to share state between the CV loop and 3D render loop
  // without triggering React re-renders for every frame.
  const rainStateRef = useRef<RainState>({
    speed: 1.0,
    isActive: false
  });

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white selection:bg-blue-500/30">
      
      {/* 3D Background */}
      <RainScene rainStateRef={rainStateRef} />

      {/* Logic Controller (Hidden or corner UI) */}
      <HandController 
        rainStateRef={rainStateRef} 
        onReady={() => setIsLoaded(true)} 
      />

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-8 md:p-12">
        
        {/* Header */}
        <header className="flex flex-col gap-2 animate-fade-in-down">
          <h1 className="text-4xl md:text-6xl font-thin tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white to-blue-300">
            Rain Stopper
          </h1>
          <p className="text-blue-200/60 text-sm md:text-base tracking-widest uppercase">
            Interactive Gesture Experience
          </p>
        </header>

        {/* Loading Indicator */}
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 backdrop-blur-md transition-opacity duration-1000">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-blue-100 tracking-wider text-sm animate-pulse">INITIALIZING VISION...</p>
            </div>
          </div>
        )}

        {/* Instructions */}
        <footer className={`flex flex-col gap-6 transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
          <div className="space-y-4 max-w-md">
            <div className="flex items-center gap-4">
              <div className="w-1 h-12 bg-gradient-to-b from-blue-400 to-transparent rounded-full"></div>
              <div>
                <h3 className="text-xl font-light">Control the Storm</h3>
                <p className="text-white/50 text-sm leading-relaxed mt-1">
                  Raise your hand to the <span className="text-blue-300">top</span> to reverse rain.<br/>
                  Hold in the <span className="text-blue-300">middle</span> to freeze time.<br/>
                  Lower hand to the <span className="text-blue-300">bottom</span> for gravity.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 items-center text-xs text-white/20">
             <span>POWERED BY MEDIAPIPE & THREE.JS</span>
          </div>
        </footer>
      </div>

      {/* Dynamic Cursor/Indicator based on hand state could go here, 
          but we let the rain reaction be the feedback. */}
    </div>
  );
};

export default App;
