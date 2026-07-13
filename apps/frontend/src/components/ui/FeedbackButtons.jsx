import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { aiAPI } from '../../services/api';

/**
 * Thumbs up / down feedback on a TrueGLE answer — training signal.
 * A thumbs-DOWN opens a mandatory brief-explanation box before it can submit
 * ("what was wrong?"); a thumbs-up submits immediately. Best-effort: a failed
 * network call never blocks the UI.
 *
 * @param {object} props
 * @param {string} props.answer   the rated answer text
 * @param {string} [props.query]  the question / context it answered
 * @param {string} [props.mode]
 * @param {string} [props.provider]
 */
export default function FeedbackButtons({ answer, query, mode, provider }) {
  const [state, setState] = useState('idle'); // idle | reason | sending | done
  const [vote, setVote] = useState(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const submit = async (v, reasonText) => {
    setState('sending');
    setError('');
    try {
      await aiAPI.feedback({ vote: v, reason: reasonText, answer, query, mode, provider });
      setVote(v);
      setState('done');
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not send — try again.');
      setState(v === 'down' ? 'reason' : 'idle');
    }
  };

  const onUp = () => submit('up');
  const onDown = () => { setState('reason'); setError(''); };
  const sendDown = () => {
    if (!reason.trim()) { setError('A brief note is required for a thumbs-down.'); return; }
    submit('down', reason.trim());
  };

  if (state === 'done') {
    return (
      <div className="flex items-center gap-1 text-[11px] text-white/40">
        <Check size={12} className={vote === 'up' ? 'text-green-400' : 'text-amber-400'} />
        Thanks for the feedback
      </div>
    );
  }

  if (state === 'reason') {
    return (
      <div className="flex flex-col gap-1.5 w-full max-w-sm">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What was wrong? (biased, inaccurate, unhelpful…) — required"
          rows={2}
          autoFocus
          className="w-full text-xs bg-black/40 border border-white/15 rounded-lg p-2 text-white/90 placeholder-white/30 outline-none resize-none focus:border-amber-400/50"
        />
        {error && <span className="text-[10px] text-red-300">{error}</span>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={sendDown}
            disabled={state === 'sending' || !reason.trim()}
            className="text-[11px] px-2 py-1 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30 transition-colors disabled:opacity-40"
          >
            Submit feedback
          </button>
          <button
            type="button"
            onClick={() => { setState('idle'); setReason(''); setError(''); }}
            className="text-[11px] text-white/40 hover:text-white/70"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onUp}
        disabled={state === 'sending'}
        title="Helpful"
        className="text-white/40 hover:text-green-400 transition-colors disabled:opacity-40"
      >
        <ThumbsUp size={13} />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={state === 'sending'}
        title="Not helpful — tell us why"
        className="text-white/40 hover:text-amber-400 transition-colors disabled:opacity-40"
      >
        <ThumbsDown size={13} />
      </button>
      {error && <span className="text-[10px] text-red-300">{error}</span>}
    </div>
  );
}
