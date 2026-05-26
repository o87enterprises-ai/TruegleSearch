import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// L33t speak character substitutions
const leetMap = {
  'a': ['4', '@', '^'],
  'b': ['8', '|3'],
  'c': ['(', '<', '{'],
  'e': ['3', '&'],
  'g': ['6', '9'],
  'i': ['1', '!', '|'],
  'l': ['1', '|', '/'],
  'o': ['0', '()'],
  's': ['5', '$', 'z'],
  't': ['7', '+'],
  'z': ['2'],
};

// Shift symbol substitutions (like typing with shift held)
const shiftSymbols = '!@#$%^&*()_+{}|:"<>?~';

// Type style transformations
const typeStyles = {
  lowercase: (text) => text.toLowerCase(),
  uppercase: (text) => text.toUpperCase(),
  capitalize: (text) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(),
  leet: (text) => {
    return text.split('').map(char => {
      const lower = char.toLowerCase();
      if (leetMap[lower] && Math.random() > 0.5) {
        return leetMap[lower][Math.floor(Math.random() * leetMap[lower].length)];
      }
      return char;
    }).join('');
  },
  mixed: (text) => {
    return text.split('').map((char, i) =>
      i % 2 === 0 ? char.toUpperCase() : char.toLowerCase()
    ).join('');
  },
};

// Backdrop SVG components - compact for mobile
const ThoughtBubbleBackdrop = ({ color, children }) => (
  <div className="relative inline-flex items-center justify-center">
    {/* Main bubble */}
    <div
      className="relative px-2 py-1 sm:px-4 sm:py-2 md:px-6 md:py-3 rounded-xl sm:rounded-2xl md:rounded-[2rem]"
      style={{
        background: `linear-gradient(135deg, ${color}ee 0%, ${color}cc 100%)`,
        boxShadow: `
          0 4px 15px ${color}40,
          inset 0 2px 4px rgba(255,255,255,0.3),
          inset 0 -2px 4px rgba(0,0,0,0.1)
        `,
        border: `2px solid ${color}`,
      }}
    >
      {children}
    </div>
    {/* Thought dots - hidden on mobile */}
    <div
      className="hidden sm:block absolute -bottom-3 -left-1 w-3 h-3 md:w-4 md:h-4 rounded-full"
      style={{
        background: `linear-gradient(135deg, ${color}ee 0%, ${color}cc 100%)`,
        border: `2px solid ${color}`,
        boxShadow: `0 2px 6px ${color}40`,
      }}
    />
    <div
      className="hidden md:block absolute -bottom-6 -left-4 w-2.5 h-2.5 rounded-full"
      style={{
        background: `linear-gradient(135deg, ${color}ee 0%, ${color}cc 100%)`,
        border: `2px solid ${color}`,
        boxShadow: `0 2px 4px ${color}40`,
      }}
    />
  </div>
);

const SpeechBubbleBackdrop = ({ color, children }) => (
  <div className="relative inline-flex items-center justify-center">
    {/* Main bubble */}
    <div
      className="relative px-2 py-1 sm:px-4 sm:py-2 md:px-6 md:py-3 rounded-lg sm:rounded-xl md:rounded-2xl"
      style={{
        background: `linear-gradient(135deg, ${color}ee 0%, ${color}cc 100%)`,
        boxShadow: `
          0 4px 15px ${color}40,
          inset 0 2px 4px rgba(255,255,255,0.3),
          inset 0 -2px 4px rgba(0,0,0,0.1)
        `,
        border: `2px solid ${color}`,
      }}
    >
      {children}
    </div>
    {/* Speech tail - smaller on mobile */}
    <div
      className="absolute -bottom-2 sm:-bottom-3 left-4 sm:left-6"
      style={{
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: `10px solid ${color}`,
        filter: `drop-shadow(0 2px 3px ${color}40)`,
      }}
    />
  </div>
);

// Compact pill/badge backdrop - minimal footprint for mobile
const PillBackdrop = ({ color, children }) => (
  <div className="relative inline-flex items-center justify-center">
    <div
      className="relative px-2 py-0.5 sm:px-3 sm:py-1 md:px-4 md:py-1.5 rounded-full"
      style={{
        background: `linear-gradient(135deg, ${color}ee 0%, ${color}dd 100%)`,
        boxShadow: `
          0 2px 8px ${color}50,
          inset 0 1px 2px rgba(255,255,255,0.25)
        `,
        border: `1.5px solid ${color}`,
      }}
    >
      {children}
    </div>
  </div>
);

const GlitchRotatingText = ({
  prefix = '',
  suffix = '',
  rotatingWords = [],
  rotationInterval = 2000,
  className = '',
  style = {},
  // Enhanced: per-word styling options
  wordStyles = null, // Array of { color, font, typeStyle, glow, backdrop, backdropColor } per word
  // Default colors - darker Truegle brand palette
  glitchColors = ["#7c3aed", "#15803d", "#b91c1c"], // darker purple, green, red
  glitchSpeed = 10,
  centerVignette = true,
  outerVignette = false,
  smooth = true,
  // New options
  enableLeetSpeak = true,
  enableShiftSymbols = true,
  enableTypeStyleVariation = true,
  backGlow = true,
  hoverGlow = true,
  neonMode = false, // Electronic neon style with bright glow
  glossyMode = false, // Glossy/shiny style like Truegle logo
  showBackdrop = false, // Show creative backdrops behind text
  glitchChance = 0.3, // Chance per check (0-1) for glitch to occur
  fontWeight = null, // Override font weight
}) => {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState(rotatingWords[0] || '');
  const [glitchActive, setGlitchActive] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [currentTypeStyle, setCurrentTypeStyle] = useState('lowercase');
  const originalTextRef = useRef(rotatingWords[0] || '');
  const glitchIntervalRef = useRef(null);

  // Available type styles for variation
  const availableTypeStyles = ['lowercase', 'uppercase', 'capitalize', 'leet', 'mixed'];

  // Default word styles with darker brand colors and varied fonts
  const defaultWordStyles = [
    {
      color: '#b91c1c', // dark red
      font: "'Inter', sans-serif",
      typeStyle: 'lowercase',
      glowColor: 'rgba(185, 28, 28, 0.6)',
      backdrop: 'thought',
      backdropColor: '#ef4444',
    },
    {
      color: '#7c3aed', // dark purple
      font: "'Space Grotesk', sans-serif",
      typeStyle: 'uppercase',
      glowColor: 'rgba(124, 58, 237, 0.6)',
      backdrop: 'speech',
      backdropColor: '#8b5cf6',
    },
    {
      color: '#0e7490', // dark cyan
      font: "'Roboto Mono', monospace",
      typeStyle: 'capitalize',
      glowColor: 'rgba(14, 116, 144, 0.6)',
      backdrop: 'nametag',
      backdropColor: '#22c55e',
    },
  ];

  const getWordStyle = (index) => {
    if (wordStyles && wordStyles[index]) {
      return wordStyles[index];
    }
    return defaultWordStyles[index % defaultWordStyles.length];
  };

  useEffect(() => {
    // Set the initial text with type style
    const initialStyle = getWordStyle(0);
    const styledText = typeStyles[initialStyle.typeStyle]?.(rotatingWords[0]) || rotatingWords[0];
    setDisplayedText(styledText || '');
    originalTextRef.current = rotatingWords[0] || '';
    setCurrentTypeStyle(initialStyle.typeStyle);
  }, [rotatingWords]);

  // Rotate the main word
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWordIndex(prevIndex => {
        const newIndex = (prevIndex + 1) % rotatingWords.length;
        const wordStyle = getWordStyle(newIndex);

        // Randomly pick a type style if variation is enabled
        let selectedTypeStyle = wordStyle.typeStyle;
        if (enableTypeStyleVariation && Math.random() > 0.5) {
          selectedTypeStyle = availableTypeStyles[Math.floor(Math.random() * availableTypeStyles.length)];
        }

        setCurrentTypeStyle(selectedTypeStyle);
        originalTextRef.current = rotatingWords[newIndex];

        // Apply the type style transformation
        const styledText = typeStyles[selectedTypeStyle]?.(rotatingWords[newIndex]) || rotatingWords[newIndex];
        setDisplayedText(styledText);

        return newIndex;
      });
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [rotatingWords, rotationInterval, enableTypeStyleVariation]);

  // Apply glitch effect periodically
  useEffect(() => {
    glitchIntervalRef.current = setInterval(() => {
      if (Math.random() > (1 - glitchChance)) {

        // Generate glitched text with various effects
        const originalText = originalTextRef.current;
        const glitchChars = enableShiftSymbols ? shiftSymbols : '!@#$%^&*';

        const glitchedText = originalText.split('').map(char => {
          const rand = Math.random();

          // 50% chance: skip character
          if (rand > 0.5) {
            return char;
          }
          // 20% chance: substitute character
          else if (rand > 0.3) {
            return glitchChars[Math.floor(Math.random() * glitchChars.length)];
          }
          // 15% chance: l33t speak
          else if (rand > 0.15) {
            const lower = char.toLowerCase();
            if (leetMap[lower]) {
              return leetMap[lower][Math.floor(Math.random() * leetMap[lower].length)];
            }
          }
          // 10% chance: random case flip
          else if (rand > 0.05) {
            return Math.random() > 0.5 ? char.toUpperCase() : char.toLowerCase();
          }
          // 5% chance: remove character
          else {
            return '';
          }
        }).join('');

        // Only update state if text actually changed
        setDisplayedText(prevText => {
          if (prevText === glitchedText) return prevText;
          return glitchedText;
        });

        // Reset to styled text after a short time
        setTimeout(() => {
          const styledText = typeStyles[currentTypeStyle]?.(originalTextRef.current) || originalTextRef.current;

          // Only update state if text actually changed
          setDisplayedText(prevText => {
            if (prevText === styledText) return prevText;
            setGlitchActive(false);
            return styledText;
          });
        }, 100);
      }
    }, 200); // Check every 200ms for glitch chance

    return () => {
      if (glitchIntervalRef.current) {
        clearInterval(glitchIntervalRef.current);
      }
    };
  }, [enableLeetSpeak, enableShiftSymbols, currentTypeStyle, glitchChance]);

  const currentStyle = getWordStyle(currentWordIndex);
  const activeColor = glitchActive ? glitchColors[0] : currentStyle.color;
  const activeGlow = currentStyle.glowColor || activeColor;
  const backdropType = currentStyle.backdrop || 'thought';
  const backdropColor = currentStyle.backdropColor || activeColor;

  // Render backdrop wrapper
  const renderWithBackdrop = (content) => {
    if (!showBackdrop) return content;

    switch (backdropType) {
      case 'thought':
        return <ThoughtBubbleBackdrop color={backdropColor}>{content}</ThoughtBubbleBackdrop>;
      case 'speech':
        return <SpeechBubbleBackdrop color={backdropColor}>{content}</SpeechBubbleBackdrop>;
      case 'pill':
        return <PillBackdrop color={backdropColor}>{content}</PillBackdrop>;
      default:
        return content;
    }
  };

  const textContent = (
    <span
      className="inline-block whitespace-nowrap relative z-10"
      style={{
        fontSize: 'inherit',
        fontFamily: currentStyle.font,
        fontWeight: fontWeight || (neonMode ? 500 : (glossyMode ? 700 : 800)),
        fontStretch: neonMode ? 'condensed' : 'normal',
        letterSpacing: neonMode ? '0.05em' : (glossyMode ? '0.02em' : 'normal'),
        color: '#ffffff', // Force white text as per requirements
        // Enhanced text shadow - different modes
        textShadow: showBackdrop
          ? (backdropType === 'nametag'
              ? 'none'
              : `0 1px 2px rgba(0,0,0,0.3)`)
          : glitchActive
          ? `
              0 0 5px ${glitchColors[0]},
              0 0 10px ${glitchColors[0]},
              0 0 20px ${glitchColors[0]},
              0 0 40px ${glitchColors[0]}
            `
          : glossyMode
          ? `
              0 1px 0 rgba(255,255,255,0.4),
              0 2px 3px rgba(0,0,0,0.3),
              0 0 12px ${activeGlow}
              ${(hoverGlow && isHovered) ? `, 0 0 20px ${activeGlow}, 0 0 30px ${activeGlow}` : ''}
            `
          : neonMode
          ? `
              0 0 2px ${activeColor},
              0 0 4px ${activeColor},
              0 0 8px ${activeGlow},
              0 0 16px ${activeGlow},
              0 0 32px ${activeGlow}
              ${(hoverGlow && isHovered) ? `, 0 0 48px ${activeGlow}, 0 0 64px ${activeGlow}, 0 0 80px ${activeGlow}` : ''}
            `
          : `
              ${backGlow ? `0 0 2px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.6),` : ''}
              0 0 8px ${activeGlow},
              0 0 16px ${activeGlow}
              ${(hoverGlow && isHovered) ? `, 0 0 30px ${activeGlow}, 0 0 50px ${activeGlow}` : ''}
            `,
        // Glossy gradient overlay effect
        backgroundImage: glossyMode && !showBackdrop
          ? `linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)`
          : 'none',
        backgroundClip: glossyMode && !showBackdrop ? 'text' : 'unset',
        WebkitBackgroundClip: glossyMode && !showBackdrop ? 'text' : 'unset',
        // Subtle stroke effect for edge definition
        WebkitTextStroke: backGlow && !neonMode && !glossyMode && !showBackdrop ? '0.5px rgba(0,0,0,0.3)' : 'none',
        filter: neonMode ? 'brightness(1.2)' : (glossyMode && !showBackdrop ? 'contrast(1.05)' : 'none'),
        transition: 'text-shadow 0.2s ease, color 0.2s ease, filter 0.2s ease',
      }}
    >
      {displayedText}
    </span>
  );

  return (
    <div
      className={`inline-flex items-center ${className}`}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {prefix && <span>{prefix}</span>}
      <div className="relative inline-flex items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentWordIndex}
            initial={{ y: 20, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.9 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 300,
              duration: 0.4
            }}
          >
            {renderWithBackdrop(textContent)}
          </motion.div>
        </AnimatePresence>
      </div>
      {suffix && <span>{suffix}</span>}
    </div>
  );
};

export default GlitchRotatingText;
