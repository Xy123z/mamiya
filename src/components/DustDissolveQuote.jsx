import { useEffect, useRef, useState } from 'react';

export default function DustDissolveQuote({
  text,
  visible,
  dissolving,
  onDissolveComplete,
}) {
  const canvasRef = useRef(null);
  const textRef = useRef(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (!dissolving || !textRef.current || !canvasRef.current) return;

    const textEl = textRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = textEl.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      onDissolveComplete?.();
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const padY = 90;
    const rightExtend = Math.max(260, window.innerWidth - rect.right + 80);
    const cssWidth = rect.width + rightExtend;
    const cssHeight = rect.height + padY * 2;

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    // Render the exact computed typography into an offscreen buffer
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.max(1, Math.round(rect.width * dpr));
    offscreen.height = Math.max(1, Math.round(rect.height * dpr));
    const offCtx = offscreen.getContext('2d');
    offCtx.scale(dpr, dpr);

    const style = window.getComputedStyle(textEl);
    offCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    offCtx.fillStyle = '#ffffff';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';

    const words = text.split(' ');
    const lines = [];
    let line = '';
    const maxLineWidth = rect.width * 0.94;
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.45;

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (offCtx.measureText(candidate).width > maxLineWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);

    const firstLineY = rect.height / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => {
      offCtx.fillText(l, rect.width / 2, firstLineY + i * lineHeight);
    });

    const pixels = offCtx.getImageData(0, 0, offscreen.width, offscreen.height).data;
    const particles = [];

    // Sample on a clean CSS-pixel grid for fine, even grain density
    const sampleStep = 3;
    for (let cy = 0; cy < rect.height; cy += sampleStep) {
      for (let cx = 0; cx < rect.width; cx += sampleStep) {
        const px = Math.min(offscreen.width - 1, Math.floor(cx * dpr));
        const py = Math.min(offscreen.height - 1, Math.floor(cy * dpr));
        const alpha = pixels[(py * offscreen.width + px) * 4 + 3] / 255;

        if (alpha > 0.25) {
          // Sweep from right edge toward left edge so the right side unravels first
          const xRatio = cx / Math.max(rect.width, 1);
          const sweepDelay = (1 - xRatio) * 1.15 + Math.random() * 0.35;

          particles.push({
            x: cx,
            y: cy + padY,
            vx: 14 + Math.random() * 26,
            vy: -4 - Math.random() * 9,
            phase: Math.random() * Math.PI * 2,
            radius: 0.55 + Math.random() * 1.15,
            baseAlpha: alpha * (0.55 + Math.random() * 0.45),
            delay: sweepDelay,
            age: 0,
            duration: 1.8 + Math.random() * 1.1,
          });
        }
      }
    }

    setAnimating(true);

    let prevTime = performance.now();
    let elapsed = 0;
    let rafId;
    let finished = false;

    const tick = (now) => {
      const dt = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;
      elapsed += dt;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      let activeCount = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (elapsed < p.delay) continue;

        p.age += dt;
        const t = p.age / p.duration;
        if (t >= 1) continue;

        activeCount++;

        // Smooth air current: drifts right and curls gently in two dimensions
        const curlX = Math.cos(elapsed * 1.4 + p.phase + p.y * 0.02) * 8;
        const curlY = Math.sin(elapsed * 1.7 + p.phase + p.x * 0.015) * 9;

        p.x += (p.vx * (0.4 + t * 1.1) + curlX) * dt;
        p.y += (p.vy + curlY) * dt;

        const fadeIn = Math.min(1, t / 0.15);
        const fadeOut = Math.pow(1 - t, 1.8);
        const currentAlpha = p.baseAlpha * fadeIn * fadeOut;

        if (currentAlpha > 0.005) {
          ctx.fillStyle = `rgba(244, 244, 245, ${currentAlpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (activeCount > 0 || elapsed < 1.35) {
        rafId = requestAnimationFrame(tick);
      } else if (!finished) {
        finished = true;
        ctx.clearRect(0, 0, cssWidth, cssHeight);
        onDissolveComplete?.();
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      setAnimating(false);
    };
  }, [dissolving, text, onDissolveComplete]);

  return (
    <div className="relative flex items-center justify-center w-full">
      <p
        ref={textRef}
        className={`max-w-3xl text-center font-serif text-2xl sm:text-3xl md:text-4xl font-light tracking-wide text-white leading-relaxed bg-transparent drop-shadow-[0_2px_14px_rgba(0,0,0,0.9)] transition-opacity ease-in-out ${
          dissolving
            ? 'opacity-0 duration-[1100ms]'
            : visible
            ? 'opacity-100 duration-[2200ms]'
            : 'opacity-0 duration-[1500ms]'
        }`}
      >
        {text}
      </p>

      <canvas
        ref={canvasRef}
        className={`absolute left-1/2 -translate-x-1/2 pointer-events-none bg-transparent ${
          animating ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
