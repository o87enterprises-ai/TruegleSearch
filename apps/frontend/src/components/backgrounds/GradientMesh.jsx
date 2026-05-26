import { motion } from 'framer-motion';

export default function GradientMesh() {
  const blobs = [
    {
      color: 'from-cyan-500/20',
      size: 'w-96 h-96',
      position: 'top-0 left-0',
      animation: { x: [0, 100, 0], y: [0, -100, 0] },
      duration: 20,
    },
    {
      color: 'from-purple-500/20',
      size: 'w-[500px] h-[500px]',
      position: 'top-1/4 right-0',
      animation: { x: [0, -80, 0], y: [0, 100, 0] },
      duration: 25,
    },
    {
      color: 'from-orange-500/20',
      size: 'w-[400px] h-[400px]',
      position: 'bottom-0 left-1/4',
      animation: { x: [0, 100, 0], y: [0, -80, 0] },
      duration: 30,
    },
    {
      color: 'from-pink-500/20',
      size: 'w-80 h-80',
      position: 'bottom-1/4 right-1/4',
      animation: { x: [0, -100, 0], y: [0, 80, 0] },
      duration: 22,
    },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {blobs.map((blob, i) => (
        <motion.div
          key={i}
          className={`absolute ${blob.size} ${blob.position} bg-gradient-radial ${blob.color} to-transparent rounded-full blur-3xl`}
          animate={blob.animation}
          transition={{
            duration: blob.duration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
