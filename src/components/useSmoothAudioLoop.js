import { useEffect, useRef, useCallback } from 'react';

export function useSmoothAudioLoop({
  audioRef,
  targetGain = 0.45,
  loopFadeSec = 1.4, // gentle fade-out at tail & fade-in at head of each loop
  fadeInSec = 2.8,
}) {
  const ctxRef = useRef(null);
  const gainNodeRef = useRef(null);
  const sourceCreatedRef = useRef(false);
  const isLoopFadingRef = useRef(false);

  const ensureAudioGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return null;

    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0.0001;
      gainNode.connect(ctx.destination);

      if (!sourceCreatedRef.current) {
        const source = ctx.createMediaElementSource(audio);
        source.connect(gainNode);
        sourceCreatedRef.current = true;
      }

      ctxRef.current = ctx;
      gainNodeRef.current = gainNode;
    }

    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume().catch(() => {});
    }

    return { ctx: ctxRef.current, gainNode: gainNodeRef.current, audio };
  }, [audioRef]);

  const startSmoothFadeIn = useCallback(() => {
    const graph = ensureAudioGraph();
    if (!graph) return;

    const { ctx, gainNode, audio } = graph;
    const now = ctx.currentTime;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), now);
    gainNode.gain.linearRampToValueAtTime(targetGain, now + fadeInSec);

    audio.play().catch((err) => console.warn('Audio playback blocked:', err));
  }, [ensureAudioGraph, targetGain, fadeInSec]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // We handle looping manually so we can dip gain cleanly at the end of each cycle
    audio.loop = false;

    const handleTimeUpdate = () => {
      const ctx = ctxRef.current;
      const gainNode = gainNodeRef.current;
      if (!ctx || !gainNode || !Number.isFinite(audio.duration) || audio.duration <= 0) {
        return;
      }

      const remaining = audio.duration - audio.currentTime;
      if (!isLoopFadingRef.current && remaining > 0 && remaining <= loopFadeSec) {
        isLoopFadingRef.current = true;
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), now);
        gainNode.gain.linearRampToValueAtTime(0.0001, now + remaining);
      }
    };

    const handleEnded = () => {
      const ctx = ctxRef.current;
      const gainNode = gainNodeRef.current;

      audio.currentTime = 0;
      isLoopFadingRef.current = false;

      if (ctx && gainNode) {
        const now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.linearRampToValueAtTime(targetGain, now + loopFadeSec);
      }

      audio.play().catch(() => {});
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioRef, loopFadeSec, targetGain]);

  return { startSmoothFadeIn };
}
