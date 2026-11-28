import { motion } from 'framer-motion';
import { Play, ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, Link2 } from 'lucide-react';
import { useLinkSafety, VERDICT } from '../../hooks/useLinkSafety';
import { usePlayInPlayer } from '../../hooks/usePlayInPlayer';
import { getPlayable } from '../../utils/videoEmbed';
import { isPlaylistUrl } from '../../utils/playlistImport';
import PlayAllButton from '../player/PlayAllButton';
import LinkOpenChoice from './LinkOpenChoice';
import { extractShare, openShare, intentLink, isNativeApp } from '../../utils/profileShare';

/*
 * ONE LINK, not a list of results.
 *
 * When the query IS a URL, a page of ten results about that URL is the wrong
 * answer — the user already knows which page they want, they just arrived
 * holding the address instead of a question. So the search page renders this
 * single card under the AI summary and suppresses the result list entirely.
 *
 * The card's job is to get them there THROUGH Truegle rather than around it:
 * they see what the link is, whether it looks safe, and one button. If it is
 * playable they never see this card at all — that case opens the player.
 */

const VERDICT_UI = {
  [VERDICT.SAFE]: {
    Icon: ShieldCheck,
    tone: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
    label: 'Looks clean',
  },
  [VERDICT.CAUTION]: {
    Icon: ShieldAlert,
    tone: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
    label: 'Take care',
  },
  [VERDICT.DANGER]: {
    Icon: ShieldAlert,
    tone: 'text-red-300 border-red-500/50 bg-red-500/10',
    label: 'Not safe',
  },
  [VERDICT.UNKNOWN]: {
    Icon: ShieldQuestion,
    tone: 'text-white/50 border-white/15 bg-white/5',
    label: 'Unrated',
  },
};

export default function SingleLinkCard({ info, description, className = '' }) {
  const safety = useLinkSafety(info?.url);
  const playInPlayer = usePlayInPlayer();
  if (!info) return null;
  const isList = isPlaylistUrl(info.url);

  const ui = VERDICT_UI[safety.verdict] || VERDICT_UI[VERDICT.UNKNOWN];
  const { Icon } = ui;
  const playable = info.kind === 'playable' && info.playerLink;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-white/10 bg-black/40 overflow-hidden ${className}`}
    >
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Link2 size={14} className="text-cyan-400" />
          <span className="text-[11px] uppercase tracking-widest text-white/40 font-semibold">
            You pasted a link
          </span>
        </div>

        <p className="truegle-selectable text-white font-semibold break-words leading-snug">
          {info.title || info.host}
        </p>
        {/* The full destination, shown rather than hidden behind the button.
            A link card that conceals where it goes is the shape of a phishing
            page, so this is deliberately the most legible thing on the card
            after the title. */}
        <p className="truegle-selectable text-xs text-green-400/80 break-all mt-1">{info.url}</p>

        {description && (
          <p className="truegle-selectable text-sm text-white/60 mt-3 leading-relaxed">{description}</p>
        )}

        {/* ── Safety ────────────────────────────────────────────────────────
            Checked locally and for free — see useLinkSafety for exactly what
            that can and cannot prove. The wording never claims more than the
            check did: "looks clean" is not "is safe", and the reasons are
            listed so the verdict is auditable rather than an oracle. */}
        <div className={`mt-4 flex items-start gap-2.5 px-3 py-2.5 rounded-xl border ${ui.tone}`}>
          {safety.loading
            ? <Loader2 size={15} className="animate-spin mt-0.5 flex-shrink-0" />
            : <Icon size={15} className="mt-0.5 flex-shrink-0" />}
          <div className="min-w-0">
            <p className="text-xs font-semibold">
              {safety.loading ? 'Checking the link…' : ui.label}
            </p>
            {!safety.loading && safety.reasons.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {safety.reasons.map((r) => (
                  <li key={r} className="truegle-selectable text-[11px] text-white/55 leading-snug">• {r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {extractShare(info.url) && (
          <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3">
            <p className="text-sm font-semibold text-emerald-200">This is a Truegle share link</p>
            <p className="mt-0.5 text-xs text-white/60">It carries saved lists. Import them here instead of opening a website.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => openShare(info.url)}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400">Import to this device</button>
              {!isNativeApp() && /Android/i.test(navigator.userAgent || '') && (
                <a href={intentLink(extractShare(info.url))} className="rounded-lg border border-cyan-400/40 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10">Open in the Truegle app</a>
              )}
            </div>
          </div>
        )}

        {playable && (
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {playable && isList && (
            <PlayAllButton
              url={info.url}
              className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/30 text-sm"
            />
          )}
          {playable && !isList && (
            <a
              href={info.playerLink}
              // In the one player, here — a plain link reloaded the page and
              // stopped whatever was playing. Still a real link for new tabs.
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                const p = getPlayable(info.url);
                if (p && playInPlayer({ ...p, title: info.title || info.url, pageUrl: info.url })) e.preventDefault();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/30 text-sm font-semibold transition-colors"
            >
              <Play size={14} /> Play in Truegle
            </a>
          )}
        </div>
        )}

        {/* The two ways out of a pasted link: Open link (own tab, always) and
            Open in app (checked, confirmed, and only when it can work). The
            link itself keeps noopener — without it the opened page gets a
            handle on this one through window.opener and can navigate it. */}
        <LinkOpenChoice url={info.url} host={info.host} title={info.title || info.host} />

        {/* Why they are being handed back out, said plainly. */}
        <p className="text-[11px] text-white/30 mt-3">
          Open link takes you to {info.host} in a new tab — come back when you&rsquo;re done.
        </p>
      </div>
    </motion.div>
  );
}
