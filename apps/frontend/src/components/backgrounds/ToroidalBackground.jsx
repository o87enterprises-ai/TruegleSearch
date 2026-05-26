import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import MagneticFieldScene from './MagneticFieldScene';

export default function ToroidalBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
      }}
    >
      <Canvas
        camera={{ position: [0, 3, 8], fov: 50 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
      >
        <Suspense fallback={null}>
          <MagneticFieldScene />
        </Suspense>
      </Canvas>

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background:
            'radial-gradient(circle at center, transparent 30%, rgba(5, 5, 30, 0.7) 70%, #050505 100%)',
          pointerEvents: 'none',
        }}
      />

      <Loader />
    </div>
  );
}
