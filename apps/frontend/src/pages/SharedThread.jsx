import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Markdown from '../components/ui/Markdown';
import LandingBackground from '../components/LandingBackground';
import TruegleLogo from '../components/ui/TruegleLogo';
import { shareAPI } from '../services/api';
import { MODE_COLORS, MODE_LABELS, getModeAccent } from '../config/modeTheme';
import { Citations } from './TruegleChat';
import InvestigationGraph from '../components/ui/InvestigationGraph';
import { fmtStamp, fmtStampFull, msgTime } from '../utils/formatTime';

// Read-only view of a shared Truegle conversation / OSINT investigation. Opens
// the LIVE thread (messages + cited links/images/videos) from a shared link —
// the whole point being that a recipient sees the real thing, not pasted text.
export default function SharedThread() {
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });

  useEffect(() => {
    let alive = true;
    shareAPI.get(id)
      .then((res) => { if (alive) setState({ status: 'ok', data: res.data, error: '' }); })
      .catch((err) => {
        if (!alive) return;
        setState({ status: 'error', data: null, error: err?.response?.data?.error || 'This shared link is invalid or has expired.' });
      });
    return () => { alive = false; };
  }, [id]);

  const payload = state.data?.payload || {};
  const modes = Array.isArray(payload.modes) && payload.modes.length ? payload.modes : [payload.mode || 'blue'];
  const primaryMode = modes[0] || 'blue';
  const accent = getModeAccent(primaryMode);
  const messages = Array.isArray(payload.messages) ? payload.messages : [];

  return (
    <div className="min-h-screen relative bg-black">
      <LandingBackground />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 20%, ${MODE_COLORS[primaryMode]}26, transparent 60%)` }}
      />
      <div className="relative z-10 min-h-screen flex flex-col items-center px-4 pt-10 pb-10">
        <Link to="/chat" className="mb-3"><TruegleLogo size="medium" animated /></Link>

        {state.status === 'loading' && (
          <p className="text-white/50 text-sm mt-10">Loading shared conversation…</p>
        )}

        {state.status === 'error' && (
          <div className="mt-10 text-center">
            <p className="text-white/70 text-sm mb-3">{state.error}</p>
            <Link to="/chat" className={`text-sm ${accent.link}`}>Start your own conversation →</Link>
          </div>
        )}

        {state.status === 'ok' && (
          <>
            <div className="flex items-center gap-2 mb-1 flex-wrap justify-center">
              {modes.map((m) => (
                <span
                  key={m}
                  className="px-3 py-1 rounded-full text-xs font-medium border text-white"
                  style={{ backgroundColor: `${MODE_COLORS[m] || '#3b82f6'}33`, borderColor: `${MODE_COLORS[m] || '#3b82f6'}80` }}
                >
                  {MODE_LABELS[m] || m}
                </span>
              ))}
            </div>
            <div className="text-[11px] text-white/40 mb-5">
              Shared {state.data.kind === 'investigation' ? 'investigation' : 'conversation'} · read-only
            </div>

            <div className="w-full max-w-2xl space-y-4 mb-6">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    m.role === 'user' ? 'bg-white/10 text-white' : `bg-black/40 border ${accent.iframeBorder} text-white/90`
                  }`}>
                    {m.role === 'assistant' ? (
                      <div className="prose prose-invert prose-sm max-w-none [&_a]:text-inherit [&_a]:underline">
                        <Markdown>{m.content}</Markdown>
                      </div>
                    ) : (
                      <p className="text-sm">{m.content}</p>
                    )}
                    <Citations citations={m.citations} accent={accent} />
                    {m.graph && <InvestigationGraph graph={m.graph} accent={accent} />}
                  </div>
                  {msgTime(m) && (
                    <time
                      dateTime={new Date(msgTime(m)).toISOString()}
                      title={fmtStampFull(msgTime(m))}
                      className="mt-1 px-1 text-[10px] text-white/30 tabular-nums select-none"
                    >
                      {fmtStamp(msgTime(m))}
                    </time>
                  )}
                </motion.div>
              ))}
            </div>

            <Link
              to="/chat"
              className={`px-4 py-2 rounded-xl text-sm font-medium border ${accent.iframeBorder} bg-white/5 hover:bg-white/10 ${accent.link} transition-colors`}
            >
              Ask your own question on Truegle →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
