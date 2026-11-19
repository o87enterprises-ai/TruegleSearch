import { useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { isLiteActive, onLiteChange } from '../utils/liteMode';

// In Lite mode framer-motion skips movement/scale animations (opacity fades still run).
export default function LiteMotion({ children }) {
  const [lite, setLite] = useState(isLiteActive);
  useEffect(() => onLiteChange(setLite), []);
  return <MotionConfig reducedMotion={lite ? 'always' : 'user'}>{children}</MotionConfig>;
}
