import React from 'react';

const ComicBubbleWrapper = ({
  children,
  className = '',
  color = '#ffffff',
  stroke = '#000000',
  text = '#000000',
  glow = 'rgba(0,0,0,0.3)',
  shadow = 'drop-shadow(4px 4px 0px rgba(0,0,0,0.15))',
}) => (
  <div
    className={`relative inline-flex items-center justify-center px-8 py-3 min-w-[140px] min-h-[165px] max-w-[200px] ${className}`}
    style={{ height: 'clamp(165px, 12vw, 210px)' }}
  >
    <div
      className="relative z-10 text-black font-bold text-center uppercase tracking-tight leading-none max-w-[180px] break-words w-full flex items-center justify-center"
      style={{ color: text, fontSize: 'inherit' }}
    >
      {children}
    </div>
  </div>
);

// 1. Classic Rounded Rect
const ClassicSpeech = ({ children, color, stroke, text, glow, shadow }) => (
  <ComicBubbleWrapper
    color={color}
    stroke={stroke}
    text={text}
    glow={glow}
    shadow={shadow}
  >
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 200 140"
      preserveAspectRatio="none"
      style={{ filter: shadow }}
    >
      <defs>
        <pattern
          id="halftone-pattern"
          x="0"
          y="0"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="1" fill="black" fillOpacity="0.15" />
        </pattern>
      </defs>
      <path
        d="M25,10 Q15,10 15,20 L15,100 Q15,110 25,110 L45,110 L35,130 L65,110 L185,110 Q195,110 195,100 L195,20 Q195,10 185,10 Z"
        fill={glow}
        transform="translate(4, 4)"
      />
      <path
        d="M20,5 Q10,5 10,15 L10,95 Q10,105 20,105 L40,105 L30,125 L60,105 L180,105 Q190,105 190,95 L190,15 Q190,5 180,5 Z"
        fill={color}
        stroke={stroke}
        strokeWidth="3"
      />
      <line x1="5" y1="0" x2="15" y2="10" stroke={stroke} strokeWidth="2" />
      <line x1="0" y1="10" x2="10" y2="15" stroke={stroke} strokeWidth="2" />
    </svg>
    <div className="whitespace-pre-line">{children}</div>
  </ComicBubbleWrapper>
);

// 2. Thought Cloud
const ThoughtBubble = ({ children, color, stroke, text, glow, shadow }) => (
  <ComicBubbleWrapper
    color={color}
    stroke={stroke}
    text={text}
    glow={glow}
    shadow={shadow}
  >
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 200 140"
      preserveAspectRatio="none"
    >
      <path
        d="M50,20 C20,20 10,50 20,75 C10,105 40,125 70,115 C80,140 130,140 145,115 C170,125 195,105 185,75 C195,50 180,20 150,20 C145,0 90,0 75,15 C65,0 40,5 50,20 Z"
        fill={color}
        stroke={stroke}
        strokeWidth="3"
      />
      <circle
        cx="45"
        cy="130"
        r="7"
        fill={color}
        stroke={stroke}
        strokeWidth="2"
      />
      <circle
        cx="32"
        cy="138"
        r="4"
        fill={color}
        stroke={stroke}
        strokeWidth="2"
      />
    </svg>
    <div className="whitespace-pre-line">{children}</div>
  </ComicBubbleWrapper>
);

// 3. Action/Explosion Bubble
const ActionBubble = ({ children, color, stroke, text, glow, shadow }) => (
  <ComicBubbleWrapper
    color={color}
    stroke={stroke}
    text={text}
    glow={glow}
    shadow={shadow}
  >
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 200 140"
      preserveAspectRatio="none"
    >
      <path
        d="M100,0 L120,35 L160,15 L150,55 L190,50 L170,85 L195,110 L155,120 L165,145 L125,120 L100,140 L75,120 L35,145 L45,120 L5,110 L30,85 L10,50 L50,55 L40,15 L80,35 Z"
        fill={color}
        stroke={stroke}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <line x1="10" y1="5" x2="30" y2="30" stroke={stroke} strokeWidth="2" />
      <line x1="190" y1="5" x2="170" y2="30" stroke={stroke} strokeWidth="2" />
    </svg>
    <div className="whitespace-pre-line">{children}</div>
  </ComicBubbleWrapper>
);

// 4. Sharp/Electric Bubble
const SharpBubble = ({ children, color, stroke, text, glow, shadow }) => (
  <ComicBubbleWrapper
    color={color}
    stroke={stroke}
    text={text}
    glow={glow}
    shadow={shadow}
  >
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 200 140"
      preserveAspectRatio="none"
    >
      <path
        d="M15,10 L185,5 L175,110 L140,110 L165,140 L105,115 L15,125 Z"
        fill={color}
        stroke={stroke}
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
    <div className="whitespace-pre-line">{children}</div>
  </ComicBubbleWrapper>
);

// 5. Oval Bubble
const OvalBubble = ({ children, color, stroke, text, glow, shadow }) => (
  <ComicBubbleWrapper
    color={color}
    stroke={stroke}
    text={text}
    glow={glow}
    shadow={shadow}
  >
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 200 140"
      preserveAspectRatio="none"
    >
      <ellipse
        cx="100"
        cy="65"
        rx="90"
        ry="55"
        fill={color}
        stroke={stroke}
        strokeWidth="3"
      />
      <path
        d="M60,115 L40,135 L80,120"
        fill={color}
        stroke={stroke}
        strokeWidth="3"
      />
      <path d="M62,114 L78,119" stroke={color} strokeWidth="5" />
    </svg>
    <div className="whitespace-pre-line">{children}</div>
  </ComicBubbleWrapper>
);

// 6. Angled Rect Bubble
const AngledRectBubble = ({ children, color, stroke, text, glow, shadow }) => (
  <ComicBubbleWrapper
    color={color}
    stroke={stroke}
    text={text}
    glow={glow}
    shadow={shadow}
  >
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 200 140"
      preserveAspectRatio="none"
    >
      <path
        d="M10,10 L190,5 L180,115 L80,120 L40,140 L65,113 L10,110 Z"
        fill={color}
        stroke={stroke}
        strokeWidth="3"
      />
    </svg>
    <div className="whitespace-pre-line">{children}</div>
  </ComicBubbleWrapper>
);

export {
  ClassicSpeech,
  ThoughtBubble,
  ActionBubble,
  SharpBubble,
  OvalBubble,
  AngledRectBubble,
};
