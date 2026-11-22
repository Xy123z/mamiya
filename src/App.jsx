import { useState, useRef } from 'react';
import IntroSequence from './components/IntroSequence';

export default function App() {
  // 'intro' | 'interrogation' | 'exited'
  const [phase, setPhase] = useState('intro');
  const [sharedPianoRef, setSharedPianoRef] = useState(null);

  const handleIntroComplete = (pianoRef) => {
    setSharedPianoRef(pianoRef);
    setPhase('interrogation');
  };

  const handleEthicalExit = () => {
    // Immediately silence audio and wipe any volatile session data
    if (sharedPianoRef?.current) {
      sharedPianoRef.current.pause();
      sharedPianoRef.current.currentTime = 0;
    }
    setPhase('exited');
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* Persistent Ethical Exit Hatch (Always accessible, subtle) */}
      {phase !== 'exited' && (
        <button
          onClick={handleEthicalExit}
          className="fixed top-6 right-6 z-50 text-xs tracking-[0.2em] uppercase text-white/35 hover:text-white/80 transition-colors duration-500 cursor-pointer"
        >
          Leave
        </button>
      )}

      {phase === 'intro' && <IntroSequence onComplete={handleIntroComplete} />}

      {phase === 'interrogation' && (
        <div className="w-full h-full bg-[#F4F3EF] text-zinc-800 flex items-center justify-center transition-colors duration-[2000ms]">
          <p className="font-serif text-xl text-zinc-600">
            Phase 2: Soothing Profile Setup will load here...
          </p>
        </div>
      )}

      {phase === 'exited' && (
        <div className="w-full h-full bg-zinc-950 text-zinc-300 flex flex-col items-center justify-center px-6 text-center">
          <h2 className="font-serif text-2xl text-white mb-4">Session Ended</h2>
          <p className="max-w-md text-sm text-zinc-400 leading-relaxed mb-8">
            Mamiya is an interactive psychological art piece inspired by Kiyoshi Kurosawa’s{' '}
            <em>Cure</em> (1997). No personal data, names, or responses were recorded or stored.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs uppercase tracking-[0.2em] text-zinc-400 hover:text-white border-b border-zinc-700 pb-1 cursor-pointer"
          >
            Restart Experience
          </button>
        </div>
      )}
    </main>
  );
}
