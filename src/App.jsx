import React from 'react';
import { useStore } from './store';
import Login from './components/Login';
import Booth from './components/Booth';
import StoryReader from './components/StoryReader';
import Studio from './components/Studio';

function App() {
  const currentPhase = useStore((state) => state.currentPhase);

  return (
    <div className="antialiased h-screen w-screen overflow-hidden">
      {currentPhase === 'LOGIN' && <Login />}
      {currentPhase === 'STORY' && <StoryReader />}
      {currentPhase === 'BOOTH' && <Booth />}
      {currentPhase === 'STUDIO' && <Studio />}
    </div>
  );
}

export default App;
