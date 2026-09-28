import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CollapsibleCard from './CollapsibleCard';
import { MODE_COLORS } from '../../config/modeTheme';

// One combined explainer card — Chat Modes and TrueGLE 1.3 (GLE) used to be
// two of three cards here; Search Modes moved to live with "Pick your lens"
// instead (see ModesAndTrending), which left two cards about the same
// surface — Chat — that read better merged than side by side.
//
// The mode list, spelled out identically wherever it's referenced, so the
// wording can't drift between here and Search Modes. "Perspectives" is gone
// as a name: it is Wonderland now, and it is a fold inside the Rabbit Hole
// rather than a lens of its own, so it is described where it lives instead
// of listed alongside its parent.
//
// Colour-matched to the same pill/lens colours everywhere else (blue/green/
// red/ocean, plus unhinged's own rose) — a name in running text should read
// the same as its chip does.
const LENS_MODES = [
  { id: 'blue', label: 'Mainstream' },
  { id: 'green', label: 'Green' },
  { id: 'red', label: 'Rabbit Hole' },
  { id: 'ocean', label: 'Privacy/OSINT' },
];

function ModeName({ id, label }) {
  return <span className="font-semibold" style={{ color: MODE_COLORS[id] }}>{label}</span>;
}

// GLE: the model card. This used to be its own third card; folded in here
// because it is describing the same conversation, one layer down — how
// TrueGLE 1.3 actually reasons once a lens has framed the question.
const THIRD_PARAGRAPH = "TrueGLE 1.3 is the locally self-hosted model behind every answer — a 100% unbiased, indifferent investigative agent capable of deep dives into every perspective without imposing an opinion. Its GLE (Grand Logic Equation) weighs a theory's claimed probability against its actual statistical odds; if they don't match, it finds the circumstances that would — applied automatically to contested claims, with no toggle to hunt for.";

export default function ThreeCards() {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl mx-auto px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <CollapsibleCard
          className="border-cyan-500/30 hover:border-cyan-400/50"
          header={(
            <>
              <span className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center shadow-lg">
                <MessageCircle size={16} className="text-white" />
              </span>
              <h3 className="text-lg font-bold bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent">
                Chat Modes &amp; TrueGLE 1.3
              </h3>
            </>
          )}
        >
          <p className="text-sm text-white/60 leading-relaxed">
            Blend lenses —{' '}
            {LENS_MODES.map((m, i) => (
              <span key={m.id}>
                <ModeName {...m} />
                {i < LENS_MODES.length - 1 ? ', ' : ''}
              </span>
            ))}
            {' '}— to shape how TrueGLE frames its answer. Pick one or stack several.
          </p>
          <p className="text-sm text-white/60 leading-relaxed">
            <ModeName id="unhinged" label="Unhinged" /> is the off-the-record register: blunt, sweary, no
            lectures. On its own it is a casual conversation; stacked on a lens it changes the voice, not
            the research. Unlocks with a verified sign-in and Safe Search off.
          </p>
          <p className="text-sm text-white/60 leading-relaxed">{THIRD_PARAGRAPH}</p>
          <button
            type="button"
            onClick={() => navigate('/chat')}
            className="self-start text-xs font-semibold bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent"
          >
            Try it →
          </button>
        </CollapsibleCard>
      </motion.div>
    </div>
  );
}
