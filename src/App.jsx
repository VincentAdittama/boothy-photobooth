import React from 'react';
import { useStore } from './store';
import Login from './components/Login';
import StoryReader from './components/StoryReader';

function App() {
  const currentPhase = useStore((state) => state.currentPhase);

  return (
    <div className="antialiased h-screen w-screen overflow-hidden">
      {currentPhase === 'LOGIN' && <Login />}
      {currentPhase === 'STORY' && <StoryReader />}

      {currentPhase === 'BOOTH' && (
        <div className="h-full flex items-center justify-center">
          <h1 className="text-4xl font-bold text-cute-pink">CAMERA PHASE (Coming Soon)</h1>
        </div>
      )}

      {currentPhase === 'STUDIO' && (
        <div className="h-full flex items-center justify-center">
          <h1 className="text-4xl font-bold text-cute-mint">STUDIO PHASE (Coming Soon)</h1>
        </div>
      )}
    </div>
  );
}

export default App;
