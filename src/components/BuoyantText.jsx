import { useEffect, useRef } from 'react';
import {
  motion,
  useAnimationControls,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from 'motion/react';
import DissolveText from './DissolveText';

const PACE_FACTOR = 1.25;
const ASCENT_SLOWDOWN = 1.15;

export default function BuoyantText({
  text = '“Those who want to know themselves come here.”',
  shouldAscend = false,
  resetSignal = 0,
  startOffsetVh = 38,
  initialScale = 0.55,
  finalScale = 1.0,
  duration = 3.5 * PACE_FACTOR * ASCENT_SLOWDOWN, // ~5.03s ascent
  horizontalDriftPx = 5,
  dissolve = false,
  dissolveDuration = Math.round(4600 * PACE_FACTOR),
  onAscentComplete,
  onDissolveComplete,
}) {
  const controls = useAnimationControls();
  const prefersReducedMotion = useReducedMotion();

  const hasStartedRef = useRef(false);
  const completedRef = useRef(false);
  const isMountedRef = useRef(true);

  const progress = useMotionValue(0);

  const buoyantScale = useTransform(progress, (p) => {
    const clamped = Math.max(0, Math.min(1, p));
    const curve = Math.pow(clamped, 0.88);
    return initialScale + (finalScale - initialScale) * curve;
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    hasStartedRef.current = false;
    completedRef.current = false;
    progress.set(0);
    controls.stop();
    controls.set({
      y: `${startOffsetVh}vh`,
      x: 0,
      scaleX: 1,
      scaleY: 1,
    });
  }, [resetSignal, startOffsetVh, controls, progress]);

  useEffect(() => {
    if (!shouldAscend || hasStartedRef.current) return;
    hasStartedRef.current = true;
    completedRef.current = false;

    let cancelled = false;

    const runSingleSpringToCenter = async () => {
      if (prefersReducedMotion) {
        progress.set(1);
        await controls.start({
          y: '0vh',
          x: 0,
          scaleX: 1,
          scaleY: 1,
          transition: {
            duration: 0.7 * PACE_FACTOR,
            ease: 'easeOut',
          },
        });
        if (!cancelled && isMountedRef.current && !completedRef.current) {
          completedRef.current = true;
          onAscentComplete?.();
        }
        return;
      }

      const driftA = horizontalDriftPx;
      const driftB = -horizontalDriftPx * 0.75;
      const driftC = horizontalDriftPx * 0.35;
      const ascentDuration = duration;

      const startTime = performance.now();
      let progressRafId = null;

      const updateBuoyancyRatio = (now) => {
        if (cancelled) return;
        const elapsedSec = (now - startTime) / 1000;
        const t = Math.min(1, elapsedSec / ascentDuration);
        const eased = 1 - Math.pow(1 - t, 2.2);
        progress.set(eased);

        if (t < 1) {
          progressRafId = requestAnimationFrame(updateBuoyancyRatio);
        } else {
          progress.set(1);
        }
      };

      progressRafId = requestAnimationFrame(updateBuoyancyRatio);

      await Promise.all([
        controls.start({
          y: '0vh',
          transition: {
            type: 'spring',
            stiffness: 17,
            damping: 15,
            mass: 1.9,
          },
        }),
        controls.start({
          x: [0, driftA, driftB, driftC, 0],
          scaleX: [1, 0.985, 0.993, 1.008, 1],
          scaleY: [1, 1.016, 1.007, 0.992, 1],
          transition: {
            duration: ascentDuration,
            times: [0, 0.28, 0.58, 0.84, 1],
            ease: 'easeInOut',
          },
        }),
      ]);

      if (progressRafId) cancelAnimationFrame(progressRafId);
      progress.set(1);

      if (!cancelled && isMountedRef.current && !completedRef.current) {
        completedRef.current = true;
        onAscentComplete?.();
      }
    };

    runSingleSpringToCenter();

    return () => {
      cancelled = true;
      progress.set(1);
    };
  }, [
    shouldAscend,
    prefersReducedMotion,
    controls,
    progress,
    startOffsetVh,
    initialScale,
    finalScale,
    duration,
    horizontalDriftPx,
    onAscentComplete,
  ]);

  return (
    <motion.div
      initial={{
        y: `${startOffsetVh}vh`,
        x: 0,
        scaleX: 1,
        scaleY: 1,
      }}
      animate={controls}
      style={{
        scale: buoyantScale,
        transformOrigin: 'center center',
      }}
      className="flex items-center justify-center w-full will-change-transform"
    >
      <DissolveText
        text={text}
        trigger="manual"
        dissolve={dissolve}
        duration={dissolveDuration}
        direction="right-to-left"
        particleSize={1.1}
        glowIntensity={0.35}
        turbulence={1}
        textClassName="text-2xl sm:text-3xl md:text-[2.65rem]"
        onComplete={onDissolveComplete}
      />
    </motion.div>
  );
}
