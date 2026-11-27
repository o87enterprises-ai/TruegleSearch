import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, AppWindow, ShieldCheck, ShieldAlert, CircleAlert, Info, Loader2 } from 'lucide-react';
import PagePreview from '../ui/PagePreview';
import { canPreview, opensOnLabel } from '../../utils/embeddable';
import { inspectUrl, VERDICT } from '../../hooks/useLinkSafety';
import { inspectLink } from '../../api/linkInspect';

/*
 * A pasted link, two ways out:
 *
 *   Open link    — always there. Opens the site in its own tab.
 *   Open in app  — only when it can actually work, and NEVER without a look
 *                  first: Truegle's server reads the link, the person sees what
 *                  it found, and nothing opens until they say so.
 *
 * "Can actually work" is decided in two steps. A cheap list of hosts known to
 * refuse framing (utils/embeddable.js) hides the button outright, so nobody is
 * invited to press something that cannot work. For everything else the server
 * reads the site's real X-Frame-Options / frame-ancestors rule (a browser can't:
 * the block is silent) and says so before anything is shown.
 *
 * WHAT IT OPENS IS WHAT WAS CHECKED. The frame loads the server's FINAL address
 * (after redirects), not the pasted one, and never an unencrypted one — the
 * viewer upgrades http to https, which would be a different page from the one
 * that was inspected.
 *
 * "COULD NOT CHECK" IS NOT "FINE". If the check fails, the app does not open it.
 * Open link still works, because that is the user leaving Truegle on purpose.
 */

const RANK = { [VERDICT.SAFE]: 0, [VERDICT.UNKNOWN]: 0, [VERDICT.CAUTION]: 1, [VERDICT.DANGER]: 2 };
const worst = (a, b) => ((RANK[b] || 0) > (RANK[a] || 0) ? b : a);

const LEVEL = {
  danger: { Icon: ShieldAlert, tone: 'text-red-300' },
  caution: { Icon: CircleAlert, tone: 'text-amber-300' },
  info: { Icon: Info, tone: 'text-white/50' },
};

export default function LinkOpenChoice({ url, host, title }) {
  const [phase, setPhase] = useState('idle');   // idle | checking | confirm | blocked | failed | open
  const [report, setReport] = useState(null);
  const ctl = useRef(null);
  useEffect(() => () => ctl.current?.abort(), []);

  const structural = inspectUrl(url);
  const dangerous = structural.verdict === VERDICT.DANGER;
  const offerInApp = canPreview(url) && !dangerous;

  const check = useCallback(async () => {
    ctl.current?.abort();
    ctl.current = new AbortController();
    setPhase('checking');
    const data = await inspectLink(url, { signal: ctl.current.signal });
    if (ctl.current.signal.aborted) return;

    if (!data?.ok) {
      setReport({ reason: data?.reason || 'unreachable' });
      setPhase('failed');
      return;
    }
    // The address it ENDED UP at gets the same structural look the pasted one got.
    const landed = inspectUrl(data.finalUrl);
    // A SAFE structural verdict's "reasons" are reassurance lines, not warnings:
    // only a caution or danger verdict contributes findings.
    const landedFindings = landed.verdict === VERDICT.CAUTION || landed.verdict === VERDICT.DANGER
      ? landed.reasons
        .filter((r) => !data.findings.some((f) => f.text === r))
        .map((text) => ({ level: landed.verdict === VERDICT.DANGER ? 'danger' : 'caution', text }))
      : [];
    const findings = [...data.findings, ...landedFindings];
    const verdict = worst(data.verdict, landed.verdict === VERDICT.UNKNOWN ? VERDICT.SAFE : landed.verdict);
    const encrypted = /^https:/i.test(data.finalUrl);

    let why = null;
    if (verdict === VERDICT.DANGER) why = 'This link looks unsafe, so Truegle will not open it inside the app.';
    else if (!data.isHtml || data.isDownload) why = 'This link is not a web page (it is a file or media), so it cannot be shown inside the app.';
    else if (!data.framing?.allowed) why = `${data.framing?.reason || 'The site does not allow it.'} It can only open in its own tab.`;
    else if (!encrypted) why = 'Truegle only shows encrypted (https) pages inside the app.';

    setReport({ ...data, findings, verdict, why });
    setPhase(why ? 'blocked' : 'confirm');
  }, [url]);

  const reset = () => { ctl.current?.abort(); setPhase('idle'); setReport(null); };

  const btn = 'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors';
  const ghost = `${btn} bg-white/5 border border-white/15 text-white/80 hover:bg-white/10 hover:text-white`;
  const cyan = `${btn} bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/30`;

  const openLink = (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className={ghost}>
      <ExternalLink size={14} /> Open link
    </a>
  );

  if (phase === 'open' && report) {
    return (
      <div className="mt-4 rounded-xl overflow-hidden border border-white/10" data-link-inapp="">
        <PagePreview url={report.finalUrl} title={title} frameClass="h-[70vh]" onClose={reset} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        {offerInApp && (phase === 'idle' || phase === 'failed' || phase === 'blocked') && (
          <button type="button" onClick={check} className={cyan}>
            <AppWindow size={14} /> Open in app
          </button>
        )}
        {!offerInApp && (
          <span
            className="text-xs text-white/35 cursor-default"
            title={dangerous ? 'This link looks unsafe, so it is not offered inside the app.' : `${host} blocks other sites from displaying its pages, so it can only open in its own tab.`}
          >
            {dangerous ? 'Not offered in the app' : opensOnLabel(url)}
          </span>
        )}
        {openLink}
      </div>

      {phase === 'checking' && (
        <p role="status" className="mt-3 flex items-center gap-2 text-xs text-white/60">
          <Loader2 size={13} className="animate-spin" /> Checking the link on Truegle&rsquo;s server&hellip;
        </p>
      )}

      {phase === 'failed' && (
        <p role="status" className="mt-3 text-xs text-amber-200/80 leading-relaxed">
          {report?.reason === 'refused'
            ? 'Truegle can’t open that address. Open link will still take you there in its own tab.'
            : report?.reason === 'busy'
              ? 'Too many checks right now — try again in a minute, or use Open link.'
              : 'Truegle couldn’t check this link just now, so it won’t open it inside the app. Open link still works.'}
        </p>
      )}

      {(phase === 'confirm' || phase === 'blocked') && report && (
        <div
          role="region"
          aria-label="Link check results"
          className={`mt-3 rounded-xl border p-3 ${report.verdict === VERDICT.DANGER ? 'border-red-500/50 bg-red-500/10' : report.verdict === VERDICT.CAUTION ? 'border-amber-500/40 bg-amber-500/10' : 'border-emerald-500/30 bg-emerald-500/5'}`}
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            {report.verdict === VERDICT.SAFE ? <ShieldCheck size={15} className="text-emerald-300" /> : <ShieldAlert size={15} className={report.verdict === VERDICT.DANGER ? 'text-red-300' : 'text-amber-300'} />}
            {phase === 'blocked'
              ? 'Can’t open this one in the app'
              : report.verdict === VERDICT.SAFE ? 'Looks clean — open it inside Truegle?' : 'Take care — open it inside Truegle anyway?'}
          </p>

          {phase === 'blocked' && <p className="truegle-selectable mt-1.5 text-xs text-white/70 leading-relaxed">{report.why}</p>}

          <p className="truegle-selectable text-[11px] text-green-400/80 break-all mt-2">{report.finalUrl}</p>

          {report.findings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {report.findings.map((f) => {
                const { Icon, tone } = LEVEL[f.level] || LEVEL.info;
                return (
                  <li key={f.text} className="truegle-selectable flex items-start gap-1.5 text-[11px] text-white/65 leading-snug">
                    <Icon size={12} className={`mt-0.5 flex-shrink-0 ${tone}`} /> {f.text}
                  </li>
                );
              })}
            </ul>
          )}

          {/* The limit of the check, on the card where it matters. A user who
              reads "looks clean" as "scanned for viruses" has been misled by us. */}
          <p className="mt-2 text-[11px] text-white/40 leading-relaxed">
            Truegle&rsquo;s server read this link&rsquo;s address, headers and the start of the page &mdash; the site saw Truegle, not you.
            It can&rsquo;t see what a page does once it loads, or whether the site shows other visitors something different, so &ldquo;looks clean&rdquo; isn&rsquo;t a guarantee.
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {phase === 'confirm' && (
              <button type="button" onClick={() => setPhase('open')} className={cyan}>
                <AppWindow size={14} /> {report.verdict === VERDICT.SAFE ? 'Open in app' : 'Open anyway'}
              </button>
            )}
            <button type="button" onClick={reset} className={ghost}>{phase === 'confirm' ? 'Cancel' : 'Close'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
