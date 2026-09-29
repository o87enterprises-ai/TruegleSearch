import { useNavigate } from 'react-router-dom';
import { CARD_ACCENT } from './cardTheme';
import { MODE_COLORS } from '../../config/modeTheme';

// Chat, past its tile's pitch: the lenses as chips in their own pill colours,
// and the way in. This used to be three paragraphs (the lenses, the Unhinged
// register, and how TrueGLE's Grand Logic Equation works); a visitor glancing
// at a landing page wants the jist, and the rest is one tap deeper in Chat.
const LENSES = [
  { id: 'blue', label: 'Mainstream' },
  { id: 'green', label: 'Green' },
  { id: 'red', label: 'Rabbit Hole' },
  { id: 'ocean', label: 'Privacy/OSINT' },
  { id: 'unhinged', label: 'Unhinged' },
];

export default function ChatBody() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3" data-chat-body="">
      <div className="flex flex-wrap gap-1.5">
        {LENSES.map((m) => (
          <span
            key={m.id}
            className="px-2 py-0.5 rounded-full border text-[11px] font-semibold"
            style={{ color: MODE_COLORS[m.id], borderColor: `${MODE_COLORS[m.id]}66` }}
          >
            {m.label}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => navigate('/chat')}
        className="self-start text-xs font-semibold"
        style={{ color: CARD_ACCENT.chat }}
      >
        Open Chat →
      </button>
    </div>
  );
}
