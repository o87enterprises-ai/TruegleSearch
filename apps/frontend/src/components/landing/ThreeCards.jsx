import { motion } from 'framer-motion';
import { MessageCircle, Compass, Brain } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// The mode list, spelled out identically wherever it's referenced (chat card,
// search card) so the two stay in sync without duplicating the wording.
// "Perspectives" is gone as a name: it is Wonderland now, and it is a fold
// inside the Rabbit Hole rather than a lens of its own, so it is described
// where it lives instead of listed alongside its parent.
const MODE_LIST = 'Mainstream, Green, Rabbit Hole, Privacy/OSINT';

// Three brief explainer cards beneath the "Why Truegle?" promise card — what
// the chat modes, search modes, and the TrueGLE 1.3 model / GLE actually are,
// for anyone who wants the detail without it cluttering the hero.
const CARDS = [
  {
    icon: MessageCircle,
    title: 'Chat Modes',
    color: 'from-cyan-500 to-blue-500',
    border: 'border-cyan-500/30 hover:border-cyan-400/50',
    description: [
      `Blend lenses — ${MODE_LIST} — to shape how TrueGLE frames its answer. Pick one or stack several.`,
      'Unhinged is the off-the-record register: blunt, sweary, no lectures. On its own it is a casual conversation; stacked on a lens it changes the voice, not the research. Unlocks with a verified sign-in and Safe Search off.',
    ],
    path: '/chat',
  },
  {
    icon: Compass,
    title: 'Search Modes',
    color: 'from-emerald-500 to-teal-500',
    border: 'border-emerald-500/30 hover:border-emerald-400/50',
    description: [
      `The same color-coded lenses — ${MODE_LIST} — applied to classic web results instead of chat. Cycle the pill above the search bar to switch between them. Green is the zero-AI one: nothing is generated, so no model runs on your query at all.`,
      'Two stops on that pill are whole surfaces rather than lenses: True Tube, where video and audio from across the web play in one pop-out player, and the Feed, where the social accounts you already read arrive in a single scroll.',
      'And inside the Rabbit Hole there is Wonderland — isolate what you found by one perspective at a time: political, faith, societal, or economic.',
    ],
    path: '/search',
  },
  {
    // Model card: introduces the TrueGLE 1.3 model itself, then GLE. GLE used
    // to be a user-facing "vs. mode" toggle; that control was removed on
    // 2026-08-13, so the copy describes it as how the model reasons about
    // contested claims rather than as a button to go and find.
    icon: Brain,
    title: 'TrueGLE 1.3',
    color: 'from-purple-500 to-fuchsia-500',
    border: 'border-purple-500/30 hover:border-purple-400/50',
    description: [
      'A locally self-hosted LLM built for privacy and transparency — a 100% unbiased, indifferent investigative agent capable of deep dives into every perspective without imposing an opinion.',
      "GLE (Grand Logic Equation) weighs a theory's claimed probability against its actual statistical odds. If they don't match the results, it finds the circumstances that would — applied automatically to contested claims, with no toggle to hunt for.",
    ],
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
          {(Array.isArray(card.description) ? card.description : [card.description]).map((para, j) => (
            <p key={j} className="text-sm text-white/60 leading-relaxed">{para}</p>
          ))}
        </motion.button>
      ))}
    </div>
  );
}
