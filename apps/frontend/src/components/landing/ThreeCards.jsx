import { motion } from 'framer-motion';
import { MessageCircle, Scale, SplitSquareHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// The three spec-mandated landing cards (docs/UI-REDESIGN-SPEC.md, "Landing
// page" #7) — replaces the old 8-feature grid, which drifted from spec.
const CARDS = [
  {
    icon: MessageCircle,
    title: 'TrueGLE Chat',
    color: 'from-cyan-500 to-blue-500',
    border: 'border-cyan-500/30 hover:border-cyan-400/50',
    description: 'Unbiased, no preconceived opinions — a self-hosted local model built for privacy and transparency, not engagement.',
    path: '/chat',
  },
  {
    icon: Scale,
    title: 'TrueGLE "vs." — Grand Logic Equation',
    color: 'from-purple-500 to-fuchsia-500',
    border: 'border-purple-500/30 hover:border-purple-400/50',
    description: "Weighs a theory's claimed probability against its actual statistical odds. If they don't match the results, it finds the circumstances that would.",
    path: '/chat',
  },
  {
    icon: SplitSquareHorizontal,
    title: 'Chat / Search',
    color: 'from-emerald-500 to-teal-500',
    border: 'border-emerald-500/30 hover:border-emerald-400/50',
    description: 'Chat for full investigations, or drop into classic search for straight web result links — same engine, your call.',
    path: '/search',
  },
];

export default function ThreeCards() {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto px-4">
      {CARDS.map((card, i) => (
        <motion.button
          key={card.title}
          type="button"
          onClick={() => navigate(card.path)}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08 }}
          whileHover={{ y: -4 }}
          className={`text-left rounded-2xl border bg-white/[0.03] backdrop-blur-sm p-6 flex flex-col gap-3 transition-all duration-300 ${card.border} hover:bg-white/[0.06]`}
        >
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
            <card.icon size={20} className="text-white" />
          </div>
          <h3 className={`text-lg font-bold bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
            {card.title}
          </h3>
          <p className="text-sm text-white/60 leading-relaxed">{card.description}</p>
        </motion.button>
      ))}
    </div>
  );
}
