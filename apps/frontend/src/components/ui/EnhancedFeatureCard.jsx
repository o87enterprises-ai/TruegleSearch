import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

export default function EnhancedFeatureCard({
  icon: Icon,
  title,
  description,
  gradient,
}) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative h-full"
      data-feature-card="true"
    >
      {/* Ripple effect background */}
      <motion.div
        className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
        animate={{
          opacity: isHovered ? 1 : 0,
        }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="absolute rounded-full"
          style={{
            left: mousePosition.x,
            top: mousePosition.y,
            width: 300,
            height: 300,
            marginLeft: -150,
            marginTop: -150,
            background:
              'radial-gradient(circle, rgba(0,229,255,0.3) 0%, transparent 70%)',
          }}
          animate={{
            scale: isHovered ? [1, 1.5] : 1,
            opacity: isHovered ? [0.5, 0] : 0,
          }}
          transition={{
            duration: 1.5,
            repeat: isHovered ? Infinity : 0,
            ease: 'easeOut',
          }}
        />
      </motion.div>

      {/* Electric border effect */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: isHovered
            ? `linear-gradient(${Math.atan2(
                mousePosition.y - 150,
                mousePosition.x - 150
              )}rad, rgba(0,229,255,0.6), rgba(139,92,246,0.6), rgba(255,107,0,0.6))`
            : 'transparent',
          padding: 'var(--ds-space-0-25)', /* 2px */
          WebkitMask:
            'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
        animate={{
          opacity: isHovered ? 1 : 0,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Card content with enhanced gradient */}
      <motion.div
        className="relative h-full rounded-2xl backdrop-blur-xl overflow-hidden card-glass"
        style={{
          padding: 'var(--ds-space-8)',
          background: `linear-gradient(135deg,
            rgba(15, 15, 35, 0.95) 0%,
            rgba(25, 25, 45, 0.9) 50%,
            rgba(15, 15, 35, 0.95) 100%)`,
          border: '1px solid rgba(0, 229, 255, 0.2)',
        }}
        whileHover={{
          scale: 1.02,
          boxShadow: '0 20px 60px rgba(0, 229, 255, 0.3)',
        }}
        transition={{ duration: 0.3 }}
      >
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${gradient})`,
          }}
        />

        {/* Icon with glow */}
        <motion.div
          data-feature-icon="true"
          className={`relative rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center`}
          style={{
            width: 'var(--ds-space-20)', /* 80px */
            height: 'var(--ds-space-20)', /* 80px */
            marginBottom: 'var(--ds-space-6)',
            boxShadow: isHovered
              ? `0 10px 40px rgba(0, 229, 255, 0.5)`
              : 'none',
          }}
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          <Icon size={36} className="text-white relative z-10" />

          {/* Icon glow */}
          <motion.div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: `radial-gradient(circle, rgba(255,255,255,0.3), transparent)`,
            }}
            animate={{
              scale: isHovered ? [1, 1.2, 1] : 1,
              opacity: isHovered ? [0.5, 0.8, 0.5] : 0,
            }}
            transition={{
              duration: 2,
              repeat: isHovered ? Infinity : 0,
              ease: 'easeInOut',
            }}
          />
        </motion.div>

        {/* Text content */}
        <h3 className="relative text-headline-medium text-white z-10" style={{ marginBottom: 'var(--ds-space-3)' }}>
          {title}
        </h3>
        <p className="relative text-body-large text-gray-300 z-10">
          {description}
        </p>

        {/* Animated particles in background */}
        {isHovered && (
          <>
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-cyan-400"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -100],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 2 + Math.random(),
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
