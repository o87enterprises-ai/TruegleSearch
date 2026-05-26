#!/bin/bash

echo "Updating TruegleLogo component..."

cat > frontend/src/components/ui/TruegleLogo.jsx << 'COMPONENT_END'
import { motion } from 'framer-motion';
import logoImage from '../../assets/images/truegle-logo.png';

export default function TruegleLogo({ 
  size = 'large', 
  animated = true,
  className = '' 
}) {
  const sizes = {
    small: 'h-12 w-auto',
    medium: 'h-20 w-auto',
    large: 'h-32 w-auto',
    xlarge: 'h-48 w-auto'
  };

  const logoElement = (
    <img
      src={logoImage}
      alt="Truegle - Unbiased Search"
      className={`${sizes[size]} ${className} object-contain`}
      style={{
        mixBlendMode: 'screen'
      }}
    />
  );

  if (animated) {
    return (
      <motion.div
        animate={{
          filter: [
            'drop-shadow(0 0 20px rgba(0, 229, 255, 0.3))',
            'drop-shadow(0 0 40px rgba(0, 229, 255, 0.6))',
            'drop-shadow(0 0 20px rgba(0, 229, 255, 0.3))'
          ]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        className="inline-block"
      >
        {logoElement}
      </motion.div>
    );
  }

  return logoElement;
}
COMPONENT_END

echo "✅ TruegleLogo component updated!"
