import { motion } from 'framer-motion';
import NeuralBackground from '../components/backgrounds/NeuralBackground';

export default function NeuralTestPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black">
      {/* Neural Network Background */}
      <NeuralBackground />

      {/* Test Content Overlay */}
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <h1 className="text-6xl font-display font-bold mb-4 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Neural Network
          </h1>
          <p className="text-xl text-gray-400 font-body">
            Testing the synaptic background for Search Portal
          </p>

          {/* Sample search bar to visualize */}
          <div className="mt-12 max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="Test search interface..."
                className="w-full px-6 py-4 bg-black/40 backdrop-blur-xl border border-cyan-500/30 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
