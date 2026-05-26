import { motion } from 'framer-motion';

export default function OrbitalRings({
  count = 3,
  colors = ['cyan', 'purple', 'orange'],
}) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: count }).map((_, i) => {
        const size = 300 + i * 200;
        const duration = 20 + i * 10;
        const delay = i * 5;
        const color = colors[i % colors.length];

        return (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 rounded-full border opacity-20"
            style={{
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              borderColor:
                color === 'cyan'
                  ? '#00E5FF'
                  : color === 'purple'
                    ? '#8B5CF6'
                    : '#FF6B00',
              borderWidth: 1,
            }}
            animate={{
              rotate: 360,
              scale: [1, 1.1, 1],
            }}
            transition={{
              rotate: {
                duration: duration,
                repeat: Infinity,
                ease: 'linear',
              },
              scale: {
                duration: duration / 2,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: delay,
              },
            }}
          />
        );
      })}
    </div>
  );
}
