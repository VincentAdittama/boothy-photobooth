import React from 'react';
import { useStore } from './store';
import Login from './components/Login';
import StoryReader from './components/StoryReader';

function App() {
  const currentPhase = useStore((state) => state.currentPhase);

  return (
    <div className="antialiased">
      {currentPhase === 'LOGIN' && <Login />}
      {currentPhase === 'STORY' && <StoryReader />}

      {currentPhase === 'BOOTH' && (
        <div className="h-screen flex items-center justify-center bg-black text-white">
          <h1 className="text-4xl">CAMERA PHASE (Coming Soon)</h1>
        </div>
      )}

      {currentPhase === 'STUDIO' && (
        <div className="h-screen flex items-center justify-center bg-black text-white">
          <h1 className="text-4xl">STUDIO PHASE (Coming Soon)</h1>
        </div>
      )}
    </div>
  );
}

export default App;
