import { Link } from 'react-router-dom';
import { Play, ExternalLink, ShieldAlert } from 'lucide-react';
import { useLinkSafety, VERDICT } from '../../hooks/useLinkSafety';
import { usePlayInPlayer } from '../../hooks/usePlayInPlayer';
import { getPlayable } from '../../utils/videoEmbed';
import { isPlaylistUrl } from '../../utils/playlistImport';
import PlayAllButton from '../player/PlayAllButton';

/*
 * The end of an answer about a link.
 *
 * Chat could already say what a URL was — it identified the playlist correctly
 * and then stopped, having described something it gave the user no way to
 * open. This is the missing last line: one button that actually does the
 * thing. Play, when Truegle can host it; open, when it cannot.
 *
 * Deliberately built from the classified URL rather than from anything in the
 * model's prose. A link the model retyped is a link that can be retyped wrong,
 * and this one is going to be clicked.
 */
export default function ChatLinkAction({ info, description }) {
  const safety = useLinkSafety(info?.url);
  const playInPlayer = usePlayInPlayer();
  if (!info) return null;

  const playable = info.kind === 'playable' && info.playerLink;
  // The player link is our own route; strip the origin so it navigates inside
  // the SPA instead of reloading the whole app.
  const playerPath = playable ? info.playerLink.replace(/^https?:\/\/[^/]+/, '') : null;
  const risky = safety.verdict === VERDICT.DANGER || safety.verdict === VERDICT.CAUTION;

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      {description && (
        <p className="truegle-selectable text-xs text-white/50 mb-2 leading-relaxed">{description}</p>
      )}

      {/* A warning EARNS its place by being specific. A generic "be careful"
          on every outbound link teaches people to click through warnings. */}
      {risky && safety.reasons.length > 0 && (
        <div className="flex items-start gap-2 mb-2 px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <ShieldAlert size={13} className="text-amber-300 mt-0.5 flex-shrink-0" />
          <p className="truegle-selectable text-[11px] text-amber-200/90 leading-snug">{safety.reasons[0]}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {playable && isPlaylistUrl(info.url) ? (
          <PlayAllButton
            url={info.url}
            size={13}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/30 text-xs"
          />
        ) : playable ? (
          <Link
            to={playerPath}
            // Plays right here, in the one player, without leaving the chat.
            // The link stays a real link (new tab, copy, middle-click), and is
            // the fallback when a source can't be built.
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              const p = getPlayable(info.url);
              if (p && playInPlayer({ ...p, title: info.title || info.url, pageUrl: info.url })) e.preventDefault();
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/30 text-xs font-semibold transition-colors"
          >
            <Play size={13} /> Play in Truegle
          </Link>
        ) : (
          <a
            href={info.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white/80 hover:bg-white/10 hover:text-white text-xs font-semibold transition-colors"
          >
            <ExternalLink size={13} /> Open on {info.host}
          </a>
        )}
        {/* Playable links keep the escape hatch to the original site: the
            embed can be geo-blocked or age-gated, and "it just doesn't work"
            with no way out is worse than sending them to the source. */}
        {playable && (
          <a
            href={info.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/45 hover:text-white/80 text-xs transition-colors"
          >
            <ExternalLink size={12} /> or on {info.host}
          </a>
        )}
      </div>
    </div>
  );
}
