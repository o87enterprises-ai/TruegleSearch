import { useState, useCallback, useEffect, useRef } from 'react';

const ShinyText = ({
  text,
  disabled = false,
  speed = 2,
  className = '',
  color = '#b5b5b5',
  shineColor = '#ffffff',
  spread = 120,
  yoyo = false,
  pauseOnHover = false,
  direction = 'left',
  delay = 0
}) => {
  const [progress, setProgress] = useState(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef(null);
  const animationFrameRef = useRef(null);
  const directionRef = useRef(direction === 'left' ? 1 : -1);

  const animationDuration = speed * 1000;
  const delayDuration = delay * 1000;

  useEffect(() => {
    directionRef.current = direction === 'left' ? 1 : -1;
    elapsedRef.current = 0;
    setProgress(0);
  }, [direction]);

  useEffect(() => {
    if (disabled) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const animate = (time) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }

      const deltaTime = time - lastTimeRef.current;
      lastTimeRef.current = time;

      elapsedRef.current += deltaTime;

      let newProgress = 0;
      // Animation goes from 0 to 100
      if (yoyo) {
        const cycleDuration = animationDuration + delayDuration;
        const fullCycle = cycleDuration * 2;
        const cycleTime = elapsedRef.current % fullCycle;

        if (cycleTime < animationDuration) {
          // Forward animation: 0 -> 100
          const p = (cycleTime / animationDuration) * 100;
          newProgress = directionRef.current === 1 ? p : 100 - p;
        } else if (cycleTime < cycleDuration) {
          // Delay at end
          newProgress = directionRef.current === 1 ? 100 : 0;
        } else if (cycleTime < cycleDuration + animationDuration) {
          // Reverse animation: 100 -> 0
          const reverseTime = cycleTime - cycleDuration;
          const p = 100 - (reverseTime / animationDuration) * 100;
          newProgress = directionRef.current === 1 ? p : 100 - p;
        } else {
          // Delay at start
          newProgress = directionRef.current === 1 ? 0 : 100;
        }
      } else {
        const cycleDuration = animationDuration + delayDuration;
        const cycleTime = elapsedRef.current % cycleDuration;

        if (cycleTime < animationDuration) {
          // Animation phase: 0 -> 100
          const p = (cycleTime / animationDuration) * 100;
          newProgress = directionRef.current === 1 ? p : 100 - p;
        } else {
          // Delay phase - hold at end (shine off-screen)
          newProgress = directionRef.current === 1 ? 100 : 0;
        }
      }

      setProgress(newProgress);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [disabled, yoyo, animationDuration, delayDuration, speed, direction]);

  const gradientStyle = {
    backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
    backgroundSize: '200% auto',
    backgroundPosition: `${150 - progress * 2}% center`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  };

  return (
    <span
      className={`inline-block ${className}`}
      style={gradientStyle}
    >
      {text}
    </span>
  );
};

export default ShinyText;