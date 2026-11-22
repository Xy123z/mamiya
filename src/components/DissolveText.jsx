import { useEffect, useRef, useState, useCallback } from 'react';

function wrapLines(ctx, text, maxWidth, lineHeight, singleLineDesktop) {
  if (singleLineDesktop) {
    return { lines: [text], lineHeight };
  }

  const paragraphs = text.split('\n');
  const lines = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }

  return { lines, lineHeight };
}

export default function DissolveText({
  text = '',
  trigger = 'manual',
  dissolve: externalDissolve = false,
  autoStart = false,
  startDelay = 0,
  particleCount = 2200,
  duration = 4600,
  direction = 'right-to-left',
  particleSize = 1.1,
  glowIntensity = 0.35,
  turbulence = 1,
  align = 'center', // 'center' | 'left'
  singleLineDesktop = true,
  className = '',
  textClassName = '',
  onComplete,
}) {
  // 'visible' | 'dissolving' | 'dissolved'
  const [phase, setPhase] = useState('visible');

  const textRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const autoStartTimerRef = useRef(null);
  const completedRef = useRef(false);
  const phaseRef = useRef('visible');

  phaseRef.current = phase;

  const finishDissolve = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setPhase('dissolved');
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    completedRef.current = false;
    setPhase('visible');
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (autoStartTimerRef.current) clearTimeout(autoStartTimerRef.current);
  }, [text]);

  useEffect(() => {
    if (trigger === 'onComplete' || autoStart) {
      if (phaseRef.current !== 'visible' || completedRef.current) return;
      autoStartTimerRef.current = setTimeout(() => {
        if (phaseRef.current === 'visible' && !completedRef.current) {
          setPhase('dissolving');
        }
      }, Math.max(0, startDelay));

      return () => {
        if (autoStartTimerRef.current) clearTimeout(autoStartTimerRef.current);
      };
    }
  }, [trigger, autoStart, startDelay, text]);

  useEffect(() => {
    if (
      trigger === 'manual' &&
      externalDissolve &&
      phaseRef.current === 'visible' &&
      !completedRef.current
    ) {
      setPhase('dissolving');
    }
  }, [trigger, externalDissolve]);

  useEffect(() => {
    if (phase !== 'dissolving') return;

    const textEl = textRef.current;
    const canvas = canvasRef.current;
    if (!textEl || !canvas) {
      finishDissolve();
      return;
    }

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const totalMs = Math.max(900, duration);

    if (reducedMotion) {
      const fadeTimer = setTimeout(() => {
        finishDissolve();
      }, Math.min(totalMs, 1100));
      return () => clearTimeout(fadeTimer);
    }

    const rect = textEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      finishDissolve();
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      finishDissolve();
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const padX = Math.min(180, Math.max(80, window.innerWidth * 0.14));
    const padY = 85;

    const cssWidth = rect.width + padX * 2;
    const cssHeight = rect.height + padY * 2;

    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const offscreen = document.createElement('canvas');
    offscreen.width = Math.max(1, Math.round(rect.width * dpr));
    offscreen.height = Math.max(1, Math.round(rect.height * dpr));
    const offCtx = offscreen.getContext('2d');
    offCtx.scale(dpr, dpr);

    const computed = window.getComputedStyle(textEl);
    const fontFamily = computed.fontFamily || 'Georgia, "Times New Roman", serif';
    const fontSize = computed.fontSize || '32px';
    const fontWeight = computed.fontWeight || '400';
    const fontStyle = computed.fontStyle || 'normal';
    const parsedSize = parseFloat(fontSize) || 32;
    const lineHeight = parseFloat(computed.lineHeight) || parsedSize * 1.45;
    const isDesktopSingleLine = singleLineDesktop && window.innerWidth >= 768;

    offCtx.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
    offCtx.fillStyle = '#F5F5F5';
    offCtx.textAlign = align === 'left' ? 'left' : 'center';
    offCtx.textBaseline = 'middle';

    const { lines } = wrapLines(
      offCtx,
      text,
      rect.width * 0.98,
      lineHeight,
      isDesktopSingleLine
    );

    const anchorX = align === 'left' ? 0 : rect.width / 2;
    const startY = rect.height / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, idx) => {
      offCtx.fillText(line, anchorX, startY + idx * lineHeight);
    });

    const w = offscreen.width;
    const h = offscreen.height;
    const pixels = offCtx.getImageData(0, 0, w, h).data;

    const alphaAt = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return 0;
      return pixels[(y * w + x) * 4 + 3] / 255;
    };

    const candidates = [];
    const stride = Math.max(1, Math.floor(dpr));
    const edgeCheckRadius = Math.max(1, Math.round(dpr * 2));

    for (let y = 0; y < h; y += stride) {
      for (let x = 0; x < w; x += stride) {
        const a = alphaAt(x, y);
        if (a <= 0.16) continue;

        let hasTransparentNeighbor = false;
        for (
          let dy = -edgeCheckRadius;
          dy <= edgeCheckRadius && !hasTransparentNeighbor;
          dy += edgeCheckRadius
        ) {
          for (
            let dx = -edgeCheckRadius;
            dx <= edgeCheckRadius;
            dx += edgeCheckRadius
          ) {
            if (dx === 0 && dy === 0) continue;
            if (alphaAt(x + dx, y + dy) < 0.25) {
              hasTransparentNeighbor = true;
              break;
            }
          }
        }

        const edgeFactor = hasTransparentNeighbor
          ? 1
          : a < 0.65
          ? 0.65
          : 0.15;

        candidates.push({
          x: x / dpr + padX,
          y: y / dpr + padY,
          nx: x / w,
          ny: y / h,
          pixelAlpha: a,
          edgeFactor,
        });
      }
    }

    if (candidates.length === 0) {
      finishDissolve();
      return;
    }

    const totalSec = totalMs / 1000;
    const count = Math.max(80, Math.min(particleCount, candidates.length));
    const step = candidates.length / count;
    const turb = Math.max(0, turbulence);
    const glow = Math.max(0, Math.min(1.2, glowIntensity));

    const particles = new Array(count);
    let maxEndTime = totalSec;

    for (let i = 0; i < count; i++) {
      const idx = Math.min(
        candidates.length - 1,
        Math.floor(i * step + (i === 0 ? 0 : Math.random() * step * 0.7))
      );
      const c = candidates[idx];

      let spatialFactor = Math.random() * 0.5;
      if (direction === 'left-to-right') {
        spatialFactor = c.nx;
      } else if (direction === 'right-to-left') {
        spatialFactor = 1 - c.nx;
      } else if (direction === 'bottom-to-top') {
        spatialFactor = 1 - c.ny;
      }

      const interiorDelay = (1 - c.edgeFactor) * totalSec * 0.22;
      const waveDelay = spatialFactor * totalSec * 0.28;
      const irregularity = (Math.random() - 0.35) * totalSec * 0.14;

      const delay = Math.max(
        0,
        Math.min(totalSec * 0.56, interiorDelay + waveDelay + irregularity)
      );

      const lifetime = totalSec * (0.34 + Math.random() * 0.22);
      if (delay + lifetime > maxEndTime) {
        maxEndTime = delay + lifetime;
      }

      const sizeRoll = Math.random();
      const sizeScale =
        sizeRoll < 0.72
          ? 0.45 + Math.random() * 0.45
          : 0.9 + Math.random() * 0.65;

      const angle = (Math.random() - 0.5) * Math.PI * 1.1;
      const speed = 5 + Math.random() * 11;
      const vx =
        Math.cos(angle) * speed + (direction === 'right-to-left' ? 3.5 : 1.5);
      const vy = Math.sin(angle) * speed - 2.5;

      const peakAlpha =
        sizeRoll < 0.72
          ? c.pixelAlpha * (0.18 + Math.random() * 0.26)
          : c.pixelAlpha * (0.38 + Math.random() * 0.32);

      particles[i] = {
        x: c.x,
        y: c.y,
        vx,
        vy,
        radius: Math.max(0.4, particleSize * sizeScale),
        peakAlpha,
        delay,
        age: 0,
        lifetime,
        phase: Math.random() * Math.PI * 2,
        freqX: 0.7 + Math.random() * 1.1,
        freqY: 0.8 + Math.random() * 1.1,
      };
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    let prevNow = performance.now();
    let elapsed = 0;

    const frame = (now) => {
      const dt = Math.min((now - prevNow) / 1000, 0.05);
      prevNow = now;
      elapsed += dt;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      let anyRemaining = false;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (elapsed < p.delay) {
          anyRemaining = true;
          continue;
        }

        p.age += dt;
        const t = p.age / p.lifetime;
        if (t >= 1) continue;

        anyRemaining = true;

        const driftX =
          Math.cos(elapsed * p.freqX + p.phase + p.y * 0.02) * 4.2 * turb;
        const driftY =
          Math.sin(elapsed * p.freqY + p.phase + p.x * 0.02) * 4.2 * turb;

        const damping = 1 - t * 0.45;
        p.x += (p.vx * damping + driftX) * dt;
        p.y += (p.vy * damping + driftY) * dt;

        const warmth = Math.min(1, t * 1.35);
        const r = Math.round(245 - warmth * 3);
        const g = Math.round(245 - warmth * 17);
        const b = Math.round(245 - warmth * 41);

        const appear = Math.min(1, t / 0.22);
        const evaporate = Math.pow(1 - t, 1.9);
        const alpha = p.peakAlpha * appear * evaporate;

        if (alpha > 0.003) {
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;

          if (glow > 0.02 && p.radius >= 1.05) {
            ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${(alpha * 0.45 * glow).toFixed(3)})`;
            ctx.shadowBlur = 5 * glow;
          } else {
            ctx.shadowBlur = 0;
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      if (anyRemaining && elapsed < maxEndTime + 0.2) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssWidth, cssHeight);
        finishDissolve();
      }
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    phase,
    text,
    direction,
    particleCount,
    duration,
    particleSize,
    glowIntensity,
    turbulence,
    align,
    singleLineDesktop,
    finishDissolve,
  ]);

  const textOpacityClass =
    phase === 'visible'
      ? 'opacity-100 duration-[2200ms]'
      : phase === 'dissolving'
      ? 'opacity-0 duration-[1900ms]'
      : 'opacity-0 duration-[400ms]';

  const alignClass =
    align === 'left'
      ? 'justify-start text-left'
      : 'justify-center text-center';

  return (
    <div className={`relative flex items-center ${alignClass} w-full bg-transparent ${className}`}>
      <p
        ref={textRef}
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        className={`${
          singleLineDesktop ? 'max-w-[92vw] md:max-w-none md:whitespace-nowrap' : 'max-w-full'
        } ${
          align === 'left' ? 'text-left' : 'text-center'
        } text-[#F5F5F5] leading-relaxed bg-transparent drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)] transition-opacity ease-in-out ${textOpacityClass} ${textClassName}`}
      >
        {text}
      </p>

      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-transparent transition-opacity duration-300 ${
          phase === 'dissolving' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
