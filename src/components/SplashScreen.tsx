import { useState, useRef, useEffect } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    document.documentElement.style.background = '#050d1a';
    document.body.style.background = '#050d1a';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.background = '';
      document.body.style.background = '';
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const clearTimers = () => {
      if (timerRef.current !== null) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    const onTimeUpdate = () => {
      if (video.duration > 0) {
        setProgress(Math.min((video.currentTime / video.duration) * 100, 100));
      }
    };

    const onEnded = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      clearTimers();
      setProgress(100);
      setFadeOut(true);
      timerRef.current = setTimeout(() => {
        document.body.style.background = '';
        onComplete();
      }, 800);
    };

    const onError = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      clearTimers();
      timerRef.current = setTimeout(() => {
        setFadeOut(true);
        timerRef.current = setTimeout(() => {
          document.body.style.background = '';
          onComplete();
        }, 600);
      }, 2000);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);

    video.play().catch(onError);

    return () => {
      clearTimers();
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
    };
  }, [onComplete]);

  return (
    <div
      className={`splash-screen ${fadeOut ? 'splash-screen--fade' : ''}`}
      role="status"
      aria-label="טוען מערכת"
    >
      <video
        ref={videoRef}
        src="/splesh.mp4"
        muted
        playsInline
        preload="auto"
        className="splash-screen__video"
      />

      <div className="splash-screen__vignette" />

      <div className="splash-screen__bar-wrap">
        <div
          className="splash-screen__bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="splash-screen__text">טוען מערכת...</p>
    </div>
  );
}
