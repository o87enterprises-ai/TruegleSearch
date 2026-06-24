import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import TruegleLogo from '../components/ui/TruegleLogo';

const NotFound = () => (
  <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 text-center">
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center gap-8"
    >
      <TruegleLogo size="large" animated />

      <div>
        <p className="text-7xl font-black text-white tracking-tight">404<span className="text-cyan-400">?!</span></p>
        <p className="mt-3 text-white/50 text-lg font-medium">Page Not Found</p>
      </div>

      <Link
        to="/"
        className="px-8 py-3 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-colors"
      >
        Return to Truegle
      </Link>
    </motion.div>
  </div>
);

export default NotFound;
