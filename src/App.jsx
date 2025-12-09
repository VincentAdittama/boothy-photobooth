import React from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useStore } from './store';
import Login from './components/Login';
import Booth from './components/Booth';
import StoryReader from './components/StoryReader';
import Studio from './components/Studio';

function App() {
  const currentPhase = useStore((state) => state.currentPhase);
  const isFlashing = useStore((state) => state.isFlashing);

  return (
    <div className="antialiased h-screen w-screen overflow-hidden">
      {currentPhase === 'LOGIN' && <Login />}
      {currentPhase === 'STORY' && <StoryReader />}
      {currentPhase === 'BOOTH' && <Booth />}
      {currentPhase === 'STUDIO' && <Studio />}

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
