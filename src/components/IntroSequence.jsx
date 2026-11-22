import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import DissolveText from './DissolveText';
import SeamlessLoopVideo from './SeamlessLoopVideo';
import { useSmoothAudioLoop } from './useSmoothAudioLoop';

const PACE_FACTOR = 1.25;
const DISSOLVE_DURATION = Math.round(4600 * PACE_FACTOR); // 5750ms
const MAMIYA_LOCK_MS = 10000; // Secret 25-second lock during the Mamiya phase
const QUESTION_WORDS = 'Do you remember the first time you saw a flame?'.split(' ');

// Subsequent clicks 0..5 after the question reaches the center:
// Index 0 = initial centered arrival
// Indices 1..5 = 1st through 5th subsequent clicks (disappear flatly, larger font, longer word-by-word delay)
// 6th subsequent click triggers final dust dissolution
const EMPHASIS_STAGES = [
  {
    fontSizeClass: 'text-2xl sm:text-3xl md:text-[2.15rem]',
    trackingClass: 'tracking-tight',
    wordDelayMs: 220,
  },
  {
    fontSizeClass: 'text-2xl sm:text-3xl md:text-[2.38rem]',
    trackingClass: 'tracking-normal',
    wordDelayMs: 340,
  },
  {
    fontSizeClass: 'text-3xl sm:text-4xl md:text-[2.62rem]',
    trackingClass: 'tracking-wide',
    wordDelayMs: 480,
  },
  {
    fontSizeClass: 'text-3xl sm:text-4xl md:text-[2.88rem]',
    trackingClass: 'tracking-wider',
    wordDelayMs: 640,
  },
  {
    fontSizeClass: 'text-4xl sm:text-5xl md:text-[3.16rem]',
    trackingClass: 'tracking-widest',
    wordDelayMs: 820,
  },
  {
    fontSizeClass: 'text-4xl sm:text-5xl md:text-[3.45rem]',
    trackingClass: 'tracking-widest',
    wordDelayMs: 1020,
  },
];

const MAX_SUBSEQUENT_CLICKS = 4;

export default function IntroSequence({ onComplete }) {
  // -1: Black pre-intro screen ("for those seeking self-discovery / please use headphones for better experience..." + Continue)
  // 0: Lighter igniting (initial delay)
  // 1: Stationary bottom quote + 3-line block on dark right side next to flame
  // 2: Question centered; subsequent clicks escalate word-by-word delay & font size, 6th dissolves
  // 3: "Mamiya" Title + Piano
  // 4: Center "Enter" Button
  const [step, setStep] = useState(-1);
  const [mediaStarted, setMediaStarted] = useState(false);

  // Staggered reveal states for the 3 right-side lines after initial delay
  const [showLine1, setShowLine1] = useState(false);
  const [visibleWordCount, setVisibleWordCount] = useState(0);
  const [showLine3, setShowLine3] = useState(false);

  // Dissolve triggers
  const [dissolveSurrounding, setDissolveSurrounding] = useState(false);
  const [dissolveQuestion, setDissolveQuestion] = useState(false);

  // Number of clicks on Continue after the question moves to the center (0..6)
  const [subsequentClickCount, setSubsequentClickCount] = useState(0);

  // Secretly locks the Mamiya title for 25 seconds after that phase appears
  const [mamiyaLocked, setMamiyaLocked] = useState(true);

  const pianoRef = useRef(null);
  const timersRef = useRef([]);
  const wordTimersRef = useRef([]);

  const { startSmoothFadeIn } = useSmoothAudioLoop({
    audioRef: pianoRef,
    targetGain: 0.45,
    loopFadeSec: 1.4,
    fadeInSec: 2.8,
  });

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }, []);

  const clearWordTimers = useCallback(() => {
    wordTimersRef.current.forEach((id) => clearTimeout(id));
    wordTimersRef.current = [];
  }, []);

  const handleIntroContinue = () => {
    if (mediaStarted) return;
    setMediaStarted(true);
    startSmoothFadeIn();
    setStep(0);
  };

  const playWordsFlatly = useCallback(
    (delayPerWordMs, initialPauseMs = 0) => {
      clearWordTimers();

      if (initialPauseMs > 0) {
        setVisibleWordCount(0);
      }

      QUESTION_WORDS.forEach((_, idx) => {
        const timerId = setTimeout(() => {
          setVisibleWordCount(idx + 1);
        }, initialPauseMs + idx * delayPerWordMs);
        wordTimersRef.current.push(timerId);
      });
    },
    [clearWordTimers]
  );

  // Start the secret 25-second lock when the Mamiya phase appears.
  // Continue remains visually active, but its click handler ignores input until this timer expires.
  useEffect(() => {
    if (step !== 3) return;

    setMamiyaLocked(true);

    const timerId = setTimeout(() => {
      setMamiyaLocked(false);
    }, MAMIYA_LOCK_MS);

    return () => clearTimeout(timerId);
  }, [step]);

  // Initial delay before showing the stationary bottom quote + the 3-line block next to the flame
  useEffect(() => {
    if (!mediaStarted) return;

    const initialDelayMs = Math.round(4500 * PACE_FACTOR);

    const startTimer = setTimeout(() => {
      setStep((prev) => (prev === 0 ? 1 : prev));

      const t1 = setTimeout(() => {
        setShowLine1(true);
      }, 350);

      const wordStartDelay = 1650;
      const wordInterval = EMPHASIS_STAGES[0].wordDelayMs;
      const wordTimers = QUESTION_WORDS.map((_, idx) =>
        setTimeout(() => {
          setVisibleWordCount(idx + 1);
        }, wordStartDelay + idx * wordInterval)
      );

      const line3Delay = wordStartDelay + QUESTION_WORDS.length * wordInterval + 650;
      const t3 = setTimeout(() => {
        setShowLine3(true);
      }, line3Delay);

      timersRef.current.push(t1, ...wordTimers, t3);
    }, initialDelayMs);

    return () => {
      clearTimeout(startTimer);
      clearAllTimers();
      clearWordTimers();
    };
  }, [mediaStarted, clearAllTimers, clearWordTimers]);

  // Called once the question finishes dissolving after the 6th subsequent click
  const handleQuestionDissolveComplete = useCallback(() => {
    setDissolveQuestion(false);
    setStep((prev) => (prev === 2 ? 3 : prev));
  }, []);

  const handleScrollCueClick = () => {
    // During Mamiya, silently ignore clicks for the first 25 seconds.
    // The button remains visible, animated, and pointer-hoverable throughout.
    if (step === 3) {
      if (mamiyaLocked) return;
      setStep(4);
      return;
    }

    // Click that moves the question to the center + dissolves quote, line 1, and line 3
    if (step === 1) {
      clearAllTimers();
      clearWordTimers();
      setVisibleWordCount(QUESTION_WORDS.length);
      setDissolveSurrounding(true);
      setSubsequentClickCount(0);
      setStep(2);
      return;
    }

    // Subsequent clicks while the question sits in the center
    if (step === 2 && !dissolveQuestion) {
      const nextCount = subsequentClickCount + 1;
      setSubsequentClickCount(nextCount);

      if (nextCount < MAX_SUBSEQUENT_CLICKS) {
        const stage =
          EMPHASIS_STAGES[Math.min(nextCount, EMPHASIS_STAGES.length - 1)];
        playWordsFlatly(stage.wordDelayMs, 150);
      } else {
        // 6th subsequent click: finally dissolve the question into dust
        clearWordTimers();
        setVisibleWordCount("Why did you keep clicking?".length);
        setDissolveQuestion(true);
      }
    }
  };

  // Keep Continue visible during the Mamiya phase as well.
  // Its click is silently ignored until the 25-second lock expires.
  const buttonVisible =
    step === 1 || (step === 2 && !dissolveQuestion) || step === 3;
  const questionCentered = step === 2;
  const currentStage =
    EMPHASIS_STAGES[
      Math.min(
        subsequentClickCount,
        MAX_SUBSEQUENT_CLICKS - 1,
        EMPHASIS_STAGES.length - 1
      )
    ];
  const displayedQuestion =
    subsequentClickCount === 3
      ? "Why did you keep clicking?".split(' ')
      : QUESTION_WORDS;

  if (step === -1) {
    return (
      <div className="relative w-screen h-screen bg-black overflow-hidden flex flex-col items-center justify-center px-6 text-center">
        <audio ref={pianoRef} src="/piano-ambient.mp3" preload="auto" />
        <p
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          className="text-xl sm:text-2xl md:text-[2.15rem] font-bold leading-relaxed text-[#F5F5F5]"
        >
          for those seeking self-discovery
          <br />
          please use headphones for better experience...
        </p>
        <button
          type="button"
          onClick={handleIntroContinue}
          className="mt-10 px-10 py-3.5 rounded-full border border-white/40 bg-transparent hover:bg-white/10 hover:border-white/80 text-[#F5F5F5] text-sm tracking-[0.25em] uppercase cursor-pointer"
        >
          continue
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen bg-zinc-950 overflow-hidden">
      <audio ref={pianoRef} src="/piano-ambient.mp3" preload="auto" />

      <SeamlessLoopVideo
        src="/lighter.mp4"
        crossfadeSec={0.45}
        className={`absolute inset-0 transition-opacity duration-[3100ms] ease-in-out ${
          step === 4 ? 'opacity-25' : 'opacity-80'
        }`}
      />

      {/* STAGE LAYER */}
      <div className="relative z-10 w-full h-full pointer-events-none">
        {/* 1. Stationary Bottom-Middle Quote */}
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 w-full px-6 flex items-center justify-center transition-opacity duration-[2200ms] ease-in-out ${
            step >= 1 && step <= 2 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <DissolveText
            text="“Those who want to know themselves come here.”"
            trigger="manual"
            dissolve={dissolveSurrounding}
            duration={DISSOLVE_DURATION}
            direction="right-to-left"
            particleSize={1.0}
            glowIntensity={0.35}
            turbulence={1}
            textClassName="text-base sm:text-lg md:text-xl font-normal tracking-wide"
          />
        </div>

        {/* 2. Three-Line Block positioned on the dark background to the right of the flame */}
        <div
          className={`fixed top-[28%] sm:top-[34%] left-[52%] sm:left-[55%] right-5 sm:right-6 md:right-14 flex flex-col items-start gap-3 sm:gap-4 transition-opacity duration-[1600ms] ${
            step >= 1 && step <= 2 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Line 1 */}
          <div
            className={`w-full transition-opacity duration-[2000ms] ease-in-out ${
              showLine1 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <DissolveText
              text="A LITTLE QUESTION"
              trigger="manual"
              dissolve={dissolveSurrounding}
              duration={DISSOLVE_DURATION}
              direction="right-to-left"
              align="left"
              particleCount={1100}
              particleSize={0.95}
              glowIntensity={0.3}
              textClassName="text-xs sm:text-sm font-normal tracking-[0.22em] sm:tracking-[0.26em] uppercase text-[#F5F5F5]/80"
            />
          </div>

          {/* Spacer preserving vertical rhythm between Line 1 and Line 3 across wrapped mobile lines */}
          <div className="min-h-[10.5rem] sm:min-h-[4.25rem] w-full" />

          {/* Line 3 */}
          <div
            className={`w-full transition-opacity duration-[2200ms] ease-in-out ${
              showLine3 ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <DissolveText
              text="it is quite all right if you don't..."
              trigger="manual"
              dissolve={dissolveSurrounding}
              duration={DISSOLVE_DURATION}
              direction="right-to-left"
              align="left"
              particleCount={1500}
              particleSize={1.0}
              glowIntensity={0.3}
              textClassName="text-sm sm:text-lg md:text-xl font-normal italic text-[#F5F5F5]/85"
            />
          </div>
        </div>

        {/* 3. Line 2 ("Do you remember the first time you saw a flame?") */}
        <motion.div
          initial={false}
          animate={
            questionCentered
              ? {
                  top: '50%',
                  left: '50%',
                  x: '-50%',
                  y: '-50%',
                }
              : {
                  top: 'calc(28% + 2.2rem)',
                  left: '52%',
                  x: '0%',
                  y: '0%',
                }
          }
          transition={{
            top: { type: 'spring', stiffness: 42, damping: 18, mass: 1.3 },
            left: { type: 'spring', stiffness: 42, damping: 18, mass: 1.3 },
            x: { type: 'spring', stiffness: 42, damping: 18, mass: 1.3 },
            y: { type: 'spring', stiffness: 42, damping: 18, mass: 1.3 },
          }}
          className={`fixed z-20 ${
            questionCentered
              ? 'w-[92vw] max-w-5xl flex justify-center'
              : 'max-w-[44vw] sm:max-w-[40vw] flex justify-start'
          } ${step >= 1 && step <= 2 ? 'opacity-100' : 'opacity-0'}`}
        >
          {!dissolveQuestion ? (
            <p
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              className={`${
                questionCentered ? 'text-center md:whitespace-nowrap' : 'text-left'
              } ${currentStage.fontSizeClass} ${
                currentStage.trackingClass
              } font-bold leading-snug text-[#F5F5F5] drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)]`}
            >
              {displayedQuestion.map((word, idx) => (
                <span
                  key={`${subsequentClickCount}-${idx}`}
                  style={{
                    visibility: idx < visibleWordCount ? 'visible' : 'hidden',
                  }}
                >
                  {word}
                  {idx < displayedQuestion.length - 1 ? ' ' : ''}
                </span>
              ))}
            </p>
          ) : (
            <DissolveText
              text="Why did you keep clicking?"
              trigger="manual"
              dissolve={dissolveQuestion}
              duration={DISSOLVE_DURATION}
              direction="right-to-left"
              align="center"
              singleLineDesktop={true}
              particleCount={2600}
              particleSize={1.15}
              glowIntensity={0.38}
              turbulence={1}
              textClassName={`${currentStage.fontSizeClass} ${currentStage.trackingClass} font-bold`}
              onComplete={handleQuestionDissolveComplete}
            />
          )}
        </motion.div>

        {/* 4. "Mamiya" Title */}
        <h1
          className={`fixed left-1/2 top-1/2 -translate-x-1/2 text-center font-serif text-5xl sm:text-6xl md:text-7xl font-normal tracking-[0.28em] uppercase text-[#F5F5F5] bg-transparent drop-shadow-[0_2px_16px_rgba(0,0,0,0.9)] transition-all duration-[3000ms] ease-in-out ${
            step === 3
              ? 'opacity-100 -translate-y-1/2 scale-100 pointer-events-none'
              : step === 4
              ? 'opacity-85 -translate-y-[calc(50%+4rem)] scale-95'
              : 'opacity-0 -translate-y-[calc(50%-1rem)] scale-95'
          }`}
        >
          Mamiya
        </h1>

        {/* 5. Center Action Button */}
        <div
          className={`fixed left-1/2 top-1/2 -translate-x-1/2 translate-y-12 transition-all duration-[2750ms] delay-500 ease-in-out ${
            step === 4
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            onClick={() => {
              if (!mamiyaLocked) onComplete(pianoRef);
            }}
            disabled={mamiyaLocked}
            className={`px-10 py-3.5 rounded-full border border-white/40 bg-transparent hover:bg-white/10 hover:border-white/80 text-[#F5F5F5] text-sm tracking-[0.25em] uppercase transition-all duration-700 ${
              mamiyaLocked ? 'cursor-default' : 'cursor-pointer'
            } drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]`}
          >
            Enter
          </button>
        </div>
      </div>

      {/* Bottom-center pulsating timeline scroll button */}
      <button
        onClick={handleScrollCueClick}
        aria-label="Continue"
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 bg-transparent text-[#F5F5F5] drop-shadow-[0_0_16px_rgba(245,245,245,0.72)] transition-opacity duration-[2000ms] ease-in-out ${
          buttonVisible
            ? 'opacity-100 pointer-events-auto cursor-pointer'
            : 'opacity-0 pointer-events-none cursor-default'
        }`}
      >
        <span className="text-xs uppercase tracking-[0.3em] font-normal animate-hypnotic-pulse drop-shadow-[0_0_12px_rgba(255,235,195,0.65)]">
          Continue
        </span>
        <svg
          className="w-6 h-6 animate-hypnotic-pulse drop-shadow-[0_0_10px_rgba(255,235,195,0.6)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}
```[cite: 1, 3]

Does this spacing look right on your phone screen, or would you like `"it is quite all right if you don't..."` shifted slightly higher or lower?
