import { motion } from 'framer-motion';
import { MessageCircle, Compass, Scale } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Three brief explainer cards beneath the "Why Truegle?" promise card — what
// the chat modes, search modes, and vs. TrueGLE / Grand Logic Equation
// actually do, for anyone who wants the detail without it cluttering the hero.
const CARDS = [
  {
    icon: MessageCircle,
    title: 'Chat Modes',
    color: 'from-cyan-500 to-blue-500',
    border: 'border-cyan-500/30 hover:border-cyan-400/50',
    description: 'Blend lenses — Mainstream, Summarize, Rabbit Hole, Perspectives, Privacy/OSINT — to shape how TrueGLE frames its answer. Pick one or stack several.',
    path: '/chat',
  },
  {
    icon: Compass,
    title: 'Search Modes',
    color: 'from-emerald-500 to-teal-500',
    border: 'border-emerald-500/30 hover:border-emerald-400/50',
    description: 'The same color-coded lenses, applied to classic web results instead of chat — cycle the pill above the search bar to switch.',
    path: '/search',
  },
  {
    icon: Scale,
    title: 'vs. TrueGLE — Grand Logic Equation',
    color: 'from-purple-500 to-fuchsia-500',
    border: 'border-purple-500/30 hover:border-purple-400/50',
    description: "Weighs a theory's claimed probability against its actual statistical odds. If they don't match the results, it finds the circumstances that would.",
    path: '/chat',
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
