import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClassicSpeech,
  ThoughtBubble,
  ActionBubble,
  SharpBubble,
  OvalBubble,
  AngledRectBubble,
} from './ComicBubbles';

const colorCycles = [
  {
    color: '#a855f7',
    stroke: '#7c3aed',
    text: '#ffffff',
    glow: 'rgba(168, 85, 247, 0.4)',
    shadow: 'drop-shadow(4px 4px 0px rgba(168, 85, 247, 0.3))',
  },
  {
    color: '#22c55e',
    stroke: '#16a34a',
    text: '#ffffff',
    glow: 'rgba(34, 197, 94, 0.4)',
    shadow: 'drop-shadow(4px 4px 0px rgba(34, 197, 94, 0.3))',
  },
  {
    color: '#ef4444',
    stroke: '#dc2626',
    text: '#ffffff',
    glow: 'rgba(239, 68, 68, 0.4)',
    shadow: 'drop-shadow(4px 4px 0px rgba(239, 68, 68, 0.3))',
  },
];

const bubbleTypes = [
  ClassicSpeech,
  ThoughtBubble,
  ActionBubble,
  SharpBubble,
  OvalBubble,
  AngledRectBubble,
];

const RandomComicBubble = ({ children, className = '' }) => {
  const [currentColorIndex, setCurrentColorIndex] = useState(0);
  const [currentBubbleIndex, setCurrentBubbleIndex] = useState(0);
  const contentRef = useRef(null);
  const prevTextRef = useRef('');

  const currentColors = colorCycles[currentColorIndex];
  const CurrentBubble = bubbleTypes[currentBubbleIndex];

  useEffect(() => {
    const checkTextChange = () => {
      if (contentRef.current) {
        const currentText = contentRef.current.textContent || '';
        if (currentText !== prevTextRef.current && currentText.trim() !== '') {
          prevTextRef.current = currentText;

          setCurrentColorIndex((prevIndex) => {
            return (prevIndex + 1) % colorCycles.length;
          });

          const randomBubbleIndex = Math.floor(
            Math.random() * bubbleTypes.length
          );
          setCurrentBubbleIndex(randomBubbleIndex);
        }
      }
    };

    const observer = new MutationObserver(checkTextChange);
    if (contentRef.current) {
      observer.observe(contentRef.current, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentColorIndex}-${currentBubbleIndex}`}
          initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.8, opacity: 0, rotate: 10 }}
          transition={{
            type: 'spring',
            damping: 20,
            stiffness: 300,
            duration: 0.3,
          }}
          className="relative inline-flex items-center justify-center"
          style={{
            height: 'clamp(165px, 12vw, 210px)',
            width: 'auto',
            minWidth: 'clamp(140px, 28vw, 200px)',
          }}
        >
          <CurrentBubble {...currentColors}>
            <div ref={contentRef}>{children}</div>
          </CurrentBubble>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default RandomComicBubble;
export { colorCycles, bubbleTypes };
