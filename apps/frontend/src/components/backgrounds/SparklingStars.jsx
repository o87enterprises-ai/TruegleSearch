import { motion } from 'framer-motion';

export default function SparklingStars() {
  // Generate a large number of stars
  const stars = Array.from({ length: 300 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 1.5 + 0.5,
    opacity: Math.random() * 0.8 + 0.2,
    delay: Math.random() * 5,
    duration: Math.random() * 3 + 2,
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      className="fixed inset-0 z-0 overflow-hidden"
    >
      {/* Gradient background for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-black" />

      {/* Distant stars - very small and subtle */}
      {stars.slice(0, 100).map((star) => (
        <div
          key={`distant-${star.id}`}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size * 0.5}px`,
            height: `${star.size * 0.5}px`,
            opacity: star.opacity * 0.4,
            boxShadow: `0 0 ${star.size * 2}px ${star.size * 1.5}px rgba(255, 255, 255, 0.1)`,
          }}
        />
      ))}

      {/* Main bright stars */}
      {stars.slice(100, 250).map((star) => (
        <motion.div
          key={`main-${star.id}`}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            boxShadow: `0 0 ${star.size * 4}px ${star.size * 2}px rgba(255, 255, 255, 0.15)`,
          }}
          animate={{
            opacity: [star.opacity * 0.5, star.opacity, star.opacity * 0.5],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Sparkling stars - brightest points */}
      {stars.slice(250).map((star) => (
        <motion.div
          key={`sparkle-${star.id}`}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size * 1.2}px`,
            height: `${star.size * 1.2}px`,
            boxShadow: `0 0 ${star.size * 6}px ${star.size * 3}px rgba(255, 255, 255, 0.2)`,
          }}
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: star.duration * 0.7,
            delay: star.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Subtle overlay for more cosmic feel */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/10" />
    </motion.div>
  );
}
