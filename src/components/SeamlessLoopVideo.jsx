import { useEffect, useRef, useState } from 'react';

export default function SeamlessLoopVideo({
  src,
  crossfadeSec = 0.45,
  className = '',
}) {
  const videoARef = useRef(null);
  const videoBRef = useRef(null);
  const [activeSlot, setActiveSlot] = useState('A'); // 'A' | 'B'
  const switchingRef = useRef(false);

  useEffect(() => {
    const startInitial = async () => {
      const vidA = videoARef.current;
      if (!vidA) return;
      vidA.currentTime = 0;
      try {
        await vidA.play();
      } catch (err) {
        console.warn('Video autoplay blocked:', err);
      }
    };
    startInitial();
  }, [src]);

  useEffect(() => {
    const checkLoopBoundary = () => {
      if (switchingRef.current) return;

      const currentVid = activeSlot === 'A' ? videoARef.current : videoBRef.current;
      const nextVid = activeSlot === 'A' ? videoBRef.current : videoARef.current;

      if (!currentVid || !nextVid || !Number.isFinite(currentVid.duration)) {
        return;
      }

      const remaining = currentVid.duration - currentVid.currentTime;
      if (remaining > 0 && remaining <= crossfadeSec) {
        switchingRef.current = true;
        nextVid.currentTime = 0;
        nextVid
          .play()
          .then(() => {
            setActiveSlot(activeSlot === 'A' ? 'B' : 'A');
            setTimeout(() => {
              switchingRef.current = false;
            }, Math.round(crossfadeSec * 1000) + 120);
          })
          .catch(() => {
            switchingRef.current = false;
          });
      }
    };

    const interval = setInterval(checkLoopBoundary, 50);
    return () => clearInterval(interval);
  }, [activeSlot, crossfadeSec]);

  const fadeMs = Math.round(crossfadeSec * 1000);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <video
        ref={videoARef}
        src={src}
        muted
        playsInline
        preload="auto"
        style={{ transitionDuration: `${fadeMs}ms` }}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity ease-in-out ${
          activeSlot === 'A' ? 'opacity-100 z-10' : 'opacity-0 z-0'
        }`}
      />
      <video
        ref={videoBRef}
        src={src}
        muted
        playsInline
        preload="auto"
        style={{ transitionDuration: `${fadeMs}ms` }}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity ease-in-out ${
          activeSlot === 'B' ? 'opacity-100 z-10' : 'opacity-0 z-0'
        }`}
      />
    </div>
  );
}
