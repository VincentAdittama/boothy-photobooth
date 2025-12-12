import React from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useStore } from './store';
import Login from './components/Login';
import Booth from './components/Booth';
import StoryReader from './components/StoryReader';
import CurtainTransition from './components/CurtainTransition';
import Studio from './components/Studio';

function App() {
  const currentPhase = useStore((state) => state.currentPhase);
  const isFlashing = useStore((state) => state.isFlashing);
  const isCameraPreloading = useStore((state) => state.isCameraPreloading);
  const isTransitioning = useStore((state) => state.isTransitioning);

  return (
    <div className="antialiased h-screen w-screen overflow-hidden">
      <CurtainTransition />
      {currentPhase === 'LOGIN' && <Login />}
      {currentPhase === 'STORY' && <StoryReader />}

      {/* Booth: Render if active phase OR if preloading during story (hidden) OR transitioning to Studio */}
      {(currentPhase === 'BOOTH' || (currentPhase === 'STORY' && isCameraPreloading) || isTransitioning) && (
        <div className={
          currentPhase === 'STORY'
            ? "fixed inset-0 opacity-0 pointer-events-none -z-50"
            : isTransitioning
              ? "h-full w-full opacity-0 pointer-events-none z-0"
              : "h-full w-full"
        }>
          <Booth />
        </div>
      )}

      {/* Studio: Wrapped with z-0 to stay behind curtain (z-100) during transition */}
      {currentPhase === 'STUDIO' && (
        <div className="h-full w-full z-0">
          <Studio />
        </div>
      )}

      {/* Full Screen Flash Overlay */}
      <AnimatePresence>
        {isFlashing && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 0.05, ease: "easeIn" }, // Quick fade in
              exit: { duration: 0.2, ease: "easeOut" } // Slow fade out
            }}
            className="fixed inset-0 hdr-flash z-50 pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
