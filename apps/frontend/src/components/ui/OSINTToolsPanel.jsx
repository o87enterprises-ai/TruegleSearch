import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Server, Shield, AtSign, Search, Loader2, ExternalLink, X, MapPin, Mail, Phone,
  Check, Minus, FileText, Download, Share2, Send, Sparkles, PanelBottom,
} from 'lucide-react';
import { aiAPI } from '../../services/api';
import LETTERHEAD_LOGO from '../../assets/osintLetterheadLogo';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const TOOLS = [
  { id: 'ip', label: 'IP Lookup', icon: MapPin, placeholder: 'e.g. 8.8.8.8', hint: 'Geolocate an IPv4 address' },
  { id: 'dns', label: 'DNS', icon: Server, placeholder: 'e.g. example.com', hint: 'Resolve DNS records' },
  { id: 'whois', label: 'WHOIS', icon: Shield, placeholder: 'e.g. example.com', hint: 'Domain registration details' },
  { id: 'email', label: 'Email', icon: Mail, placeholder: 'e.g. name@example.com', hint: 'Validity, MX, disposable/role & Gravatar' },
  { id: 'phone', label: 'Phone', icon: Phone, placeholder: 'e.g. +14155552671', hint: 'Validity, line type, country & formats (include country code)' },
  { id: 'username', label: 'Username / Name', icon: AtSign, placeholder: 'username or full name (spaces OK)', hint: 'Find profiles across platforms — usernames or real names' },
];

const DNS_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA'];

// Pull the distinct entities out of a free-text query so a blob like
// "5416230460 Odin Idesae OShea therealduckyduck@gmail.com" gets split into a
// phone, an email and a residual name — each routed to the right tool instead
// of the whole string being crammed into every field.
function parseEntities(raw) {
  const s = (raw || '').trim();
  let rest = ` ${s} `;
  const take = (re) => {
    const found = [];
    rest = rest.replace(re, (m) => { found.push(m.trim()); return ' '; });
    return found;
  };
  const emails = take(/[^\s@]+@[^\s@]+\.[^\s@]+/g);
  const ips = take(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
  const domains = take(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/gi);      // after emails/ips removed
  const phones = take(/\+?\d[\d\s().-]{6,}\d/g);                  // 8+ digit runs, symbols ok
  const name = rest.replace(/\s+/g, ' ').trim();                 // whatever's left = name/handle
  return { emails, ips, domains, phones, name };
}

// The value a given tool should actually receive from the parsed entities.
function valueForTool(toolId, ent, raw) {
  if (toolId === 'email') return ent.emails[0] || '';
  if (toolId === 'ip') return ent.ips[0] || '';
  if (toolId === 'phone') return ent.phones[0] || '';
  if (toolId === 'whois' || toolId === 'dns') return ent.domains[0] || '';
  return ent.name || raw; // username / name
}

// Auto-select the tools that actually have something to work with.
function defaultToolsFor(q) {
  const ent = parseEntities(q);
  const tools = [];
  if (ent.emails.length) tools.push('email');
  if (ent.phones.length) tools.push('phone');
  if (ent.ips.length) tools.push('ip');
  if (ent.domains.length) tools.push('whois');
  if (ent.name) tools.push('username');
  return tools.length ? tools : ['username'];
}

function pickUrl(toolId, q, dnsType) {
  const e = encodeURIComponent(q);
  if (toolId === 'ip') return `${BACKEND}/api/osint/ip-lookup?ip=${e}`;
  if (toolId === 'dns') return `${BACKEND}/api/osint/dns-lookup?domain=${e}&type=${dnsType}`;
  if (toolId === 'whois') return `${BACKEND}/api/osint/whois?domain=${e}`;
  if (toolId === 'email') return `${BACKEND}/api/osint/email-intel?email=${e}`;
  if (toolId === 'phone') return `${BACKEND}/api/osint/phone-intel?phone=${e}`;
  return `${BACKEND}/api/osint/username-platforms?username=${e}`;
}

// Flatten a completed tool result into gatherable Intel items (each with a
// stable id so ticking a checkbox toggles it in/out of the debrief).
function itemsFor(toolId, res, query) {
  if (!res || res.error) return [];
  const val = res._value || query; // the value this tool was actually run on
  if (toolId === 'username') {
    return (res.platforms || []).map((p) => ({
      id: `u:${p.name}`,
      tool: 'username',
      title: p.name,
      detail: p.exists === true ? 'Confirmed account exists'
        : p.exists === false ? 'No account found'
        : 'Candidate — verify manually',
      url: p.url,
      status: p.exists,          // true | false | null
      checkable: p.checkable,
    }));
  }
  const d = res.data || {};
  if (toolId === 'ip') return [{ id: 'ip', tool: 'ip', title: `IP ${d.ip || val}`, detail: [d.city, d.region, d.country, d.org].filter(Boolean).join(', '), url: d.loc ? `https://www.google.com/maps?q=${d.loc}` : null }];
  if (toolId === 'phone') return [{ id: 'phone', tool: 'phone', title: `Phone ${d.formats?.international || d.input || val}`, detail: d.valid ? `${(d.type || 'unknown').replace(/_/g, ' ')} · ${d.countryName || d.country || ''}` : 'Not a valid number' }];
  if (toolId === 'email') return [{ id: 'email', tool: 'email', title: d.email || val, detail: `${d.mxFound ? 'Domain accepts mail' : 'No MX'}${d.disposable ? ' · disposable' : ''}${d.role ? ' · role address' : ''}${d.gravatarExists ? ' · Gravatar found' : ''}`, url: d.gravatarUrl || null }];
  if (toolId === 'whois') return [{ id: 'whois', tool: 'whois', title: `WHOIS ${d.domain || val}`, detail: [d.registrar, d.registeredOn && new Date(d.registeredOn).toLocaleDateString()].filter(Boolean).join(' · ') }];
  if (toolId === 'dns') return [{ id: 'dns', tool: 'dns', title: `DNS ${val}`, detail: (d.Answer || []).map((a) => a.data).join(', ') || 'No records' }];
  return [];
}

// Plain-text digest of every current finding, handed to the AI for the brief.
function intelDigest(query, results) {
  const lines = [];
  for (const toolId of Object.keys(results)) {
    const items = itemsFor(toolId, results[toolId], query);
    for (const it of items) {
      const mark = it.status === true ? '[CONFIRMED]' : it.status === false ? '[NOT FOUND]' : '';
      lines.push(`- ${it.title}: ${it.detail} ${mark}${it.url ? ` (${it.url})` : ''}`.trim());
    }
    if (results[toolId]?.error) lines.push(`- ${toolId}: lookup failed (${results[toolId].error})`);
  }
  return lines.join('\n') || '(no findings)';
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Map each tool to a debrief category, matching the Truegle OSINT letterhead
// template (Name · Number · Email · Username · Address · IP · Domain · Links).
const DEBRIEF_SECTIONS = [
  { key: 'username', label: 'Name / Username', tools: ['username'] },
  { key: 'phone', label: 'Number', tools: ['phone'] },
  { key: 'email', label: 'Email', tools: ['email'] },
  { key: 'ip', label: 'IP', tools: ['ip'] },
  { key: 'domain', label: 'Domain', tools: ['whois', 'dns'] },
];

function badgeHtml(it) {
  if (it.status === true) return ' <span class="badge ok">CONFIRMED</span>';
  if (it.status === false) return ' <span class="badge no">NOT FOUND</span>';
  if (it.status === null && it.tool === 'username') return ' <span class="badge cand">CANDIDATE</span>';
  return '';
}

// Branded, self-contained HTML debrief — the "Open Source Intel Debrief"
// letterhead: rainbow TrueGLE OSINT™ wordmark, categorized findings, diagonal
// watermark. Opens in any browser, prints to PDF, shares in full.
function buildDebriefHtml(query, items, extra = {}) {
  const now = new Date();
  const { summary = '', notes = '' } = extra;
  const sections = DEBRIEF_SECTIONS.map((sec) => {
    const rows = items.filter((it) => sec.tools.includes(it.tool)).map((it) => `
        <div class="entry">
          <div class="entry-head"><span class="src">${esc(it.title)}</span>${badgeHtml(it)}</div>
          <div class="detail">${esc(it.detail)}</div>
          ${it.url ? `<a class="ref" href="${esc(it.url)}">${esc(it.url)}</a>` : ''}
        </div>`).join('');
    if (!rows) return '';
    return `<section><h2>${esc(sec.label)}</h2>${rows}</section>`;
  }).join('');
  const watermark = Array.from({ length: 20 }).map(() => '<div class="wm-row">TRUEGLE&nbsp;OSINT&nbsp;•&nbsp;CONFIDENTIAL&nbsp;&nbsp;&nbsp;TRUEGLE&nbsp;OSINT&nbsp;•&nbsp;CONFIDENTIAL&nbsp;&nbsp;&nbsp;TRUEGLE&nbsp;OSINT</div>').join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TrueGLE OSINT — Open Source Intel Debrief — ${esc(query)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0b1220; margin: 0; background: #05060a; }
  .sheet { background:#0b0d12; }
  .wm { position: fixed; inset: -20%; z-index: 0; transform: rotate(-30deg); pointer-events: none; overflow: hidden; }
  .wm-row { font-size: 30px; font-weight: 800; letter-spacing: 2px; color: rgba(255,255,255,0.035); white-space: nowrap; line-height: 2.6; }
  .page { position: relative; z-index: 1; max-width: 900px; margin: 0 auto; padding: 40px 44px 56px; color:#e5e7eb; }
  .letterhead { text-align:center; padding-bottom: 22px; border-bottom: 2px solid rgba(255,255,255,0.12); }
  .kicker { font-size: 15px; letter-spacing: 1px; color:#cbd5e1; margin-bottom: 10px; }
  .logo { display:block; margin: 0 auto; width: 320px; max-width: 80%; height: auto; }
  .meta { display:flex; justify-content:space-between; font-size: 12px; color:#94a3b8; margin: 18px 0 8px; }
  .conf { display:inline-block; padding:3px 10px; border:1.5px solid #ef4444; color:#ef4444; border-radius:4px; font-weight:700; letter-spacing:1px; }
  .subject { font-size: 14px; color:#cbd5e1; margin: 10px 0 24px; }
  section { margin-bottom: 20px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 2px; color:#67e8f9; border-bottom:1px solid rgba(103,232,249,0.25); padding-bottom:5px; margin: 0 0 10px; }
  .entry { padding: 8px 0; border-bottom:1px solid rgba(255,255,255,0.06); }
  .entry-head { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
  .src { font-weight:600; color:#fff; font-size: 14px; }
  .detail { font-size: 13px; color:#cbd5e1; margin-top: 3px; }
  .ref { display:inline-block; margin-top: 3px; font-size: 12px; color:#38bdf8; word-break: break-all; }
  .note { font-size: 13px; color:#e5e7eb; line-height:1.6; }
  a { color: #38bdf8; }
  .badge { font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px; }
  .badge.ok { background:rgba(16,185,129,0.2); color:#6ee7b7; }
  .badge.no { background:rgba(239,68,68,0.2); color:#fca5a5; }
  .badge.cand { background:rgba(245,158,11,0.2); color:#fcd34d; }
  .foot { margin-top: 30px; padding-top: 16px; border-top:1px solid rgba(255,255,255,0.12); font-size: 11px; color:#94a3b8; line-height:1.7; text-align:center; }
  .foot .brandline { color:#cbd5e1; font-weight:700; letter-spacing:1px; }
  @media print { body,.sheet{ background:#0b0d12 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head>
<body class="sheet">
  <div class="wm">${watermark}</div>
  <div class="page">
    <div class="letterhead">
      <div class="kicker">Open Source Intel Debrief</div>
      <img class="logo" src="${LETTERHEAD_LOGO}" alt="TrueGLE OSINT™" />
    </div>
    <div class="meta">
      <span>Ref: TG-${now.getTime().toString(36).toUpperCase()}</span>
      <span class="conf">CONFIDENTIAL</span>
      <span>${now.toLocaleString()}</span>
    </div>
    <div class="subject">Subject of investigation: <strong style="color:#fff">${esc(query)}</strong> · ${items.length} finding${items.length === 1 ? '' : 's'} compiled</div>
    ${summary ? `<section><h2>Analyst Summary</h2><div class="note">${esc(summary)}</div></section>` : ''}
    ${sections || '<p style="color:#94a3b8">No findings were selected for this debrief.</p>'}
    ${notes ? `<section><h2>Notes</h2><div class="note">${esc(notes).replace(/\n/g, '<br>')}</div></section>` : ''}
    <div class="foot">
      Compiled by TrueGLE 1.3 from lawful, publicly-available open sources only. Findings marked
      <strong>CANDIDATE</strong> are unverified profile guesses and must be confirmed manually before being relied upon.
      This document is confidential and intended solely for the requesting party.<br><br>
      <span class="brandline">TrueGLE OSINT ™</span><br>
      ™ ${now.getFullYear()} ALL RIGHTS RESERVED ® · https://truegle.info
    </div>
  </div>
</body></html>`;
}

function extractAi(res) {
  return res?.data?.response?.choices?.[0]?.message?.content
    || res?.data?.response?.content || res?.data?.response || 'No response received.';
}

/**
 * Interactive OSINT module for Ocean mode. One shared input (prefilled with the
 * searched query) drives multiple selectable recon tools; findings collect in an
 * Intel section with honest confirmed/not-found/candidate labels and per-finding
 * checkboxes; an AI analyst summarizes them and, on confirmation, compiles the
 * ticked findings into a branded, downloadable/shareable Intel debrief. A
 * best-effort iframe split-view opens verification pages in-place.
 */
export default function OSINTToolsPanel({ initialQuery = '' }) {
  const [selected, setSelected] = useState(() => new Set(defaultToolsFor(initialQuery)));
  const [input, setInput] = useState(initialQuery || ''); // never null — .trim() runs each render
  const [dnsType, setDnsType] = useState('A');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState({});       // toolId -> json | {error}
  const [gathered, setGathered] = useState({});      // itemId -> item
  const [confirming, setConfirming] = useState(false);
  const [notesStep, setNotesStep] = useState(false); // final-notes step before download
  const [debriefNotes, setDebriefNotes] = useState('');
  const [debriefSummary, setDebriefSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [messages, setMessages] = useState([]);      // AI results-summary chat
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [debriefHtml, setDebriefHtml] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);      // in-Intel verify iframe
  const [previewBlocked, setPreviewBlocked] = useState(false);
  const [splitUrl, setSplitUrl] = useState(null);          // below-debrief split view
  const [splitBlocked, setSplitBlocked] = useState(false);

  const panelRef = useRef(null);
  const chatEndRef = useRef(null);
  const lastQueryRef = useRef('');

  // When a fresh query arrives from the search bar, prefill the box, point it at
  // the most likely tools, and scroll the tools into focus (the user's view
  // lands here, not on the web results below).
  useEffect(() => {
    const q = (initialQuery || '').trim();
    if (!q || q === lastQueryRef.current) return;
    lastQueryRef.current = q;
    setInput(q);
    setSelected(new Set(defaultToolsFor(q)));
    setResults({});
    setGathered({});
    setMessages([]);
    setDebriefHtml(null);
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [initialQuery]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, chatLoading]);

  const toggleTool = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next.size ? next : new Set([id]); // never empty
    });

  const run = async (e) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q || selected.size === 0 || running) return;
    setRunning(true);
    const ent = parseEntities(q);
    const entries = await Promise.all(
      [...selected].map(async (toolId) => {
        const val = valueForTool(toolId, ent, q);
        const label = TOOLS.find((t) => t.id === toolId)?.label || toolId;
        if (!val) return [toolId, { error: `No ${label.toLowerCase()} value found in your query — add one or run this tool on its own.` }];
        try {
          const resp = await fetch(pickUrl(toolId, val, dnsType));
          const json = await resp.json();
          if (!resp.ok || json.error) return [toolId, { error: json.error || 'Lookup failed' }];
          return [toolId, { ...json, _value: val }]; // remember what this tool was run on

        } catch (err) {
          return [toolId, { error: err.message || 'Lookup failed' }];
        }
      })
    );
    const next = Object.fromEntries(entries);
    setResults(next);
    setRunning(false);
    generateSummary(q, next);
  };

  const generateSummary = async (q, res) => {
    const digest = intelDigest(q, res);
    setMessages([]);
    setChatLoading(true);
    try {
      const r = await aiAPI.chat(
        `You are TrueGLE's OSINT analyst. Give a short investigator's brief on the subject "${q}" using ONLY the findings below. State plainly what is CONFIRMED, what is unverified/CANDIDATE, and 2–3 recommended next checks. Keep it lawful and public-source only. Then tell the user they can tick the checkbox next to any finding in the Intel section above and you'll compile a downloadable Intel debrief.\n\nFINDINGS:\n${digest}`,
        { context: 'osint', verbose: true, history: [] }
      );
      setMessages([{ id: Date.now(), role: 'assistant', content: extractAi(r) }]);
    } catch {
      setMessages([{ id: Date.now(), role: 'assistant', content: "Couldn't reach the analyst just now — your findings are in the Intel section above. Tick any you want and I'll still compile the debrief." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const digest = intelDigest(input.trim(), results);
    const history = [
      { role: 'assistant', content: `OSINT findings for "${input.trim()}":\n${digest}` },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', content: text }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const r = await aiAPI.chat(text, { context: 'osint', verbose: true, history });
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: extractAi(r) }]);
    } catch {
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: "Couldn't reach the analyst just now — try again in a moment." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const toggleGather = (item) =>
    setGathered((prev) => {
      const next = { ...prev };
      next[item.id] ? delete next[item.id] : (next[item.id] = item);
      return next;
    });

  const gatheredCount = Object.keys(gathered).length;

  // Confirm → go to the final-notes step (not straight to download): the
  // analyst drafts a closing summary the user can edit and add notes to.
  const startNotes = async () => {
    if (!gatheredCount) return;
    setConfirming(false);
    setNotesStep(true);
    setDebriefSummary('');
    setSummarizing(true);
    try {
      const digest = intelDigest(input.trim(), results);
      const r = await aiAPI.chat(
        `Write a 2–4 sentence closing analyst summary for an OSINT debrief on "${input.trim()}", based only on these findings. State the overall picture, confidence, and any caveat. No preamble.\n\nFINDINGS:\n${digest}`,
        { context: 'osint', verbose: false, history: [] }
      );
      setDebriefSummary(extractAi(r));
    } catch {
      setDebriefSummary('');
    } finally {
      setSummarizing(false);
    }
  };

  // Build the final debrief (findings + analyst summary + user notes) and reveal
  // the download/share panel.
  const finalize = () => {
    setDebriefHtml(buildDebriefHtml(input.trim(), Object.values(gathered), { summary: debriefSummary.trim(), notes: debriefNotes.trim() }));
    setNotesStep(false);
    requestAnimationFrame(() => document.getElementById('osint-debrief')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const downloadDebrief = () => {
    const blob = new Blob([debriefHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `truegle-intel-debrief-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareDebrief = async () => {
    try {
      const file = new File([debriefHtml], 'truegle-intel-debrief.html', { type: 'text/html' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Truegle OSINT Intel Debrief' });
        return;
      }
    } catch { /* fall through to download */ }
    downloadDebrief();
  };

  const openSplit = (u) => { setSplitUrl(u); setSplitBlocked(false); requestAnimationFrame(() => document.getElementById('osint-split')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
  const openPreview = (u) => { setPreviewUrl(u); setPreviewBlocked(false); };

  const hasResults = Object.keys(results).length > 0;

  return (
    <div ref={panelRef} className="max-w-4xl mx-auto mb-6 p-5 rounded-2xl bg-gradient-to-br from-[#0a1f33]/95 to-[#001020]/95 backdrop-blur-2xl border-2 border-cyan-500/40 shadow-lg shadow-cyan-500/10 scroll-mt-24">
      <div className="mb-4 text-center">
        <img src={LETTERHEAD_LOGO} alt="TrueGLE OSINT" className="h-14 mx-auto" />
        <p className="text-xs text-cyan-300/50 mt-1">free recon · no key required · pick one or more tools</p>
      </div>

      {/* Multi-select tool tabs */}
      <ToolSelector selected={selected} onToggle={toggleTool} />

      {/* Shared input (prefilled with the searched query) */}
      <form onSubmit={run} className="flex flex-wrap gap-2 items-center mt-3">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 border border-cyan-500/20 focus-within:border-cyan-500/50 transition-colors">
          <Search size={15} className="text-cyan-400/60 flex-shrink-0" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="username, name, email, phone, IP or domain…"
            className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm focus:outline-none"
          />
        </div>
        {selected.has('dns') && (
          <select
            value={dnsType}
            onChange={(e) => setDnsType(e.target.value)}
            className="px-2 py-2 rounded-xl bg-black/40 border border-cyan-500/20 text-white text-sm focus:outline-none focus:border-cyan-500/50"
          >
            {DNS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <button
          type="submit"
          disabled={running || !input.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-[#001020] text-sm font-semibold transition-colors"
        >
          {running ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          Run {selected.size > 1 ? `${selected.size} tools` : ''}
        </button>
      </form>

      {/* Parsed-entity chips — shows how the query was identified & where each
          part is routed, so a mixed blob doesn't get crammed into every tool. */}
      <ParsedChips input={input} />

      {/* ── INTEL SECTION ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {hasResults && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
            <SectionLabel>Intel · findings</SectionLabel>
            <div className="space-y-4">
              {[...selected].filter((t) => results[t]).map((toolId) => (
                <FindingCard
                  key={toolId}
                  toolId={toolId}
                  res={results[toolId]}
                  query={input.trim()}
                  gathered={gathered}
                  onToggleGather={toggleGather}
                  onPreview={openPreview}
                  onSplit={openSplit}
                />
              ))}
            </div>

            {/* In-Intel verify iframe (X-Frame-aware) */}
            <AnimatePresence>
              {previewUrl && (
                <VerifyFrame url={previewUrl} blocked={previewBlocked} onBlocked={() => setPreviewBlocked(true)} onClose={() => setPreviewUrl(null)} />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RESULTS SUMMARY (AI analyst chat) ──────────────────────────── */}
      {(messages.length > 0 || chatLoading) && (
        <div className="mt-5">
          <SectionLabel><Sparkles size={12} className="inline mr-1 -mt-0.5" />Results summary</SectionLabel>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {messages.map((m) => (
              <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  m.role === 'user' ? 'bg-cyan-500/15 text-white' : 'bg-black/40 border border-white/10 text-white/90'
                }`}>
                  {m.role === 'assistant'
                    ? <div className="prose prose-invert prose-sm max-w-none [&_a]:underline"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                    : m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3.5 py-2.5 bg-black/40 border border-white/10 flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400/60 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-cyan-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-cyan-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Gather → confirm → compile debrief */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={gatheredCount === 0}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-200 text-sm font-semibold hover:bg-cyan-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <FileText size={14} />
                Compile Intel debrief{gatheredCount ? ` (${gatheredCount})` : ''}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 border border-cyan-500/30">
                <span className="text-sm text-white/80">Add {gatheredCount} finding{gatheredCount === 1 ? '' : 's'} to the debrief?</span>
                <button type="button" onClick={startNotes} className="px-3 py-1 rounded-lg bg-cyan-500 text-[#001020] text-xs font-bold hover:bg-cyan-400">Confirm</button>
                <button type="button" onClick={() => setConfirming(false)} className="px-3 py-1 rounded-lg bg-white/5 text-white/60 text-xs hover:bg-white/10">Cancel</button>
              </div>
            )}
            {gatheredCount === 0 && !notesStep && (
              <span className="text-xs text-white/30">Tick the checkbox on any finding above to include it.</span>
            )}
          </div>

          {/* Final-notes step — analyst closing summary (editable) + user notes,
              added to the debrief before it's finalized for download. */}
          <AnimatePresence>
            {notesStep && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 rounded-xl border border-cyan-500/30 bg-black/30 p-3"
              >
                <SectionLabel>Final notes · before download</SectionLabel>
                <label className="text-[11px] text-white/40">Analyst summary {summarizing && <span className="text-cyan-300/60">(drafting…)</span>}</label>
                <textarea
                  rows={3}
                  value={debriefSummary}
                  onChange={(e) => setDebriefSummary(e.target.value)}
                  placeholder={summarizing ? 'Drafting a closing summary…' : 'Closing analyst summary (editable)…'}
                  className="mt-1 mb-3 w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white/90 placeholder-white/25 outline-none focus:border-cyan-500/40 resize-y"
                />
                <label className="text-[11px] text-white/40">Your notes (optional)</label>
                <textarea
                  rows={2}
                  value={debriefNotes}
                  onChange={(e) => setDebriefNotes(e.target.value)}
                  placeholder="Add any final notes, context, or caveats to include in the debrief…"
                  className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white/90 placeholder-white/25 outline-none focus:border-cyan-500/40 resize-y"
                />
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" onClick={finalize} disabled={summarizing} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500 text-[#001020] text-sm font-bold hover:bg-cyan-400 disabled:opacity-40 transition-colors">
                    <FileText size={14} /> Finalize debrief
                  </button>
                  <button type="button" onClick={() => setNotesStep(false)} className="px-3 py-2 rounded-xl bg-white/5 text-white/60 text-xs hover:bg-white/10">Cancel</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Follow-up chat input (below the AI chat, above the debrief) */}
          <div className="mt-3 flex items-end gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
            <textarea
              rows={1}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder="Ask the analyst a follow-up…"
              className="flex-1 bg-transparent resize-none outline-none text-white placeholder-white/30 text-sm p-1.5 max-h-32"
            />
            <button
              type="button"
              onClick={sendChat}
              disabled={!chatInput.trim() || chatLoading}
              className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                chatInput.trim() && !chatLoading ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200' : 'bg-white/5 text-white/20 cursor-not-allowed'
              }`}
            >
              <Send size={15} />
            </button>
          </div>

          {/* Secondary tool selector (below the input) — add tools and re-run */}
          <div className="mt-3">
            <SectionLabel>Add another tool</SectionLabel>
            <ToolSelector selected={selected} onToggle={toggleTool} compact />
            <button
              type="button"
              onClick={() => run()}
              disabled={running || !input.trim()}
              className="mt-2 flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/5 border border-cyan-500/30 text-cyan-200 text-xs font-semibold hover:bg-white/10 disabled:opacity-40 transition-colors"
            >
              {running ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              Run selected on “{input.trim() || '…'}”
            </button>
          </div>
        </div>
      )}

      {/* ── DEBRIEF ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {debriefHtml && (
          <motion.div
            id="osint-debrief"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 scroll-mt-24"
          >
            <SectionLabel><FileText size={12} className="inline mr-1 -mt-0.5" />OSINT Intel debrief</SectionLabel>
            <div className="rounded-xl overflow-hidden border border-cyan-500/30">
              <div className="flex items-center justify-between px-3 py-2 bg-black/50 border-b border-white/5">
                <span className="text-xs text-cyan-300/70">{Object.keys(gathered).length} findings · Truegle letterhead</span>
                <div className="flex gap-2">
                  <button onClick={downloadDebrief} className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"><Download size={12} /> Download</button>
                  <button onClick={shareDebrief} className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"><Share2 size={12} /> Share</button>
                  <button onClick={() => setDebriefHtml(null)} className="text-white/30 hover:text-white"><X size={14} /></button>
                </div>
              </div>
              <iframe title="Intel debrief" srcDoc={debriefHtml} className="w-full h-[60vh] bg-white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SPLIT VIEW (verification pages, parallel plane) ─────────────── */}
      <AnimatePresence>
        {splitUrl && (
          <motion.div
            id="osint-split"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-5 scroll-mt-24"
          >
            <SectionLabel><PanelBottom size={12} className="inline mr-1 -mt-0.5" />Verification view</SectionLabel>
            <VerifyFrame url={splitUrl} blocked={splitBlocked} onBlocked={() => setSplitBlocked(true)} onClose={() => setSplitUrl(null)} tall />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return <div className="text-[11px] uppercase tracking-widest text-cyan-300/50 font-semibold mb-2">{children}</div>;
}

// Shows the entities detected in the query (email/phone/IP/domain/name) so the
// user can see the parse before running — each routes to its matching tool.
function ParsedChips({ input }) {
  const ent = parseEntities(input);
  const chips = [
    ...ent.emails.map((v) => ['Email', v]),
    ...ent.phones.map((v) => ['Phone', v]),
    ...ent.ips.map((v) => ['IP', v]),
    ...ent.domains.map((v) => ['Domain', v]),
    ...(ent.name ? [['Name', ent.name]] : []),
  ];
  if (chips.length <= 1) return null; // nothing to disambiguate
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-white/30">Detected:</span>
      {chips.map(([k, v], i) => (
        <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-200/80">
          <span className="text-cyan-300/60">{k}:</span> {v}
        </span>
      ))}
    </div>
  );
}

function ToolSelector({ selected, onToggle, compact }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const on = selected.has(t.id);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onToggle(t.id)}
            aria-pressed={on}
            className={`flex items-center gap-1.5 rounded-lg font-medium transition-all ${compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
              on ? 'bg-cyan-500/25 text-cyan-100 border border-cyan-400/60' : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
            }`}
          >
            <span className={`flex items-center justify-center w-3.5 h-3.5 rounded-[4px] border ${on ? 'bg-cyan-400 border-cyan-400' : 'border-white/25'}`}>
              {on && <Check size={10} className="text-[#001020]" />}
            </span>
            <Icon size={compact ? 12 : 14} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function GatherBox({ item, gathered, onToggle }) {
  const on = !!gathered[item.id];
  return (
    <button
      type="button"
      onClick={() => onToggle(item)}
      title={on ? 'Remove from debrief' : 'Add to debrief'}
      className={`flex items-center justify-center w-5 h-5 rounded-md border flex-shrink-0 transition-colors ${
        on ? 'bg-cyan-400 border-cyan-400' : 'border-white/25 hover:border-cyan-400/60'
      }`}
    >
      {on && <Check size={12} className="text-[#001020]" />}
    </button>
  );
}

function StatusBadge({ status, checkable }) {
  if (status === true) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">CONFIRMED</span>;
  if (status === false) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">NOT FOUND</span>;
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">{checkable ? 'UNKNOWN' : 'CANDIDATE'}</span>;
}

// A single tool's finding, with a gather checkbox (per-platform for username).
function FindingCard({ toolId, res, query, gathered, onToggleGather, onPreview, onSplit }) {
  const tool = TOOLS.find((t) => t.id === toolId);
  const Icon = tool?.icon || Shield;
  if (res?.error) {
    return (
      <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-3 text-sm text-red-300 flex items-center gap-2">
        <Icon size={14} /> {tool?.label}: {res.error}
      </div>
    );
  }
  const items = itemsFor(toolId, res, query);
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border-b border-white/5">
        <Icon size={13} className="text-cyan-400" />
        <span className="text-xs font-semibold text-white/80">{tool?.label}</span>
      </div>
      {toolId === 'username' ? (
        <div className="p-3">
          <p className="text-xs text-white/40 mb-3">
            {items.length} candidate sources · tick to add to the debrief · Verify opens a preview below.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                <GatherBox item={it} gathered={gathered} onToggle={onToggleGather} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-white/90 truncate">{it.title}</span>
                    <StatusBadge status={it.status} checkable={it.checkable} />
                  </div>
                  <div className="text-[11px] text-white/30 truncate">{it.url}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => onSplit(it.url)} className="text-xs text-cyan-400 hover:text-cyan-300">Verify</button>
                  <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white"><ExternalLink size={13} /></a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3">
          {/* Rich renderer + a single gather row */}
          {toolId === 'ip' && <IpResult data={res.data} />}
          {toolId === 'dns' && <DnsResult data={res.data} />}
          {toolId === 'whois' && <WhoisResult data={res.data} />}
          {toolId === 'email' && <EmailResult data={res.data} />}
          {toolId === 'phone' && <PhoneResult data={res.data} />}
          {items.map((it) => (
            <div key={it.id} className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
              <GatherBox item={it} gathered={gathered} onToggle={onToggleGather} />
              <span className="text-xs text-white/60 truncate">Add to debrief: <span className="text-white/80">{it.title}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VerifyFrame({ url, blocked, onBlocked, onClose, tall }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-4 rounded-xl overflow-hidden border border-cyan-500/20"
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/50 border-b border-white/5">
        <span className="text-xs text-cyan-300/70 truncate flex-1 mr-2">{url}</span>
        <div className="flex gap-2 flex-shrink-0">
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"><ExternalLink size={11} /> Open link</a>
          <button onClick={onClose} className="text-xs text-white/30 hover:text-white"><X size={14} /></button>
        </div>
      </div>
      {blocked ? (
        <div className="flex flex-col items-center justify-center py-8 bg-black/20 gap-2">
          <p className="text-sm text-white/50 text-center px-4">This page can’t be embedded (it blocks framing). Open it in a new tab to verify.</p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"><ExternalLink size={12} /> Open in new tab</a>
        </div>
      ) : (
        <iframe
          key={url}
          src={url}
          className={`w-full ${tall ? 'h-[70vh]' : 'h-[55vh]'} bg-white`}
          title="OSINT verification preview"
          sandbox="allow-scripts allow-same-origin"
          onLoad={(e) => {
            try {
              if (!e.target.contentDocument || e.target.contentDocument.body?.innerHTML === '') onBlocked();
            } catch { onBlocked(); }
          }}
        />
      )}
    </motion.div>
  );
}

// ── Result renderers (unchanged display for solid tools) ──────────────────────

function Field({ label, value }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-cyan-300/50">{label}</div>
      <div className="text-sm text-white/90 truncate">{value}</div>
    </div>
  );
}

function IpResult({ data }) {
  if (!data) return null;
  const mapsUrl = data.loc ? `https://www.google.com/maps?q=${data.loc}` : null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <Field label="IP" value={data.ip} />
      <Field label="City" value={data.city} />
      <Field label="Region" value={data.region} />
      <Field label="Country" value={data.country} />
      <Field label="Org / ISP" value={data.org} />
      <Field label="Postal" value={data.postal} />
      <Field label="Timezone" value={data.timezone} />
      <Field label="Coordinates" value={data.loc} />
      <Field label="Hostname" value={data.hostname} />
      {mapsUrl && (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 col-span-2 sm:col-span-3">
          <MapPin size={12} /> View on map
        </a>
      )}
    </div>
  );
}

function DnsResult({ data }) {
  const answers = data?.Answer || [];
  return answers.length === 0 ? (
    <p className="text-sm text-white/50">No records found.</p>
  ) : (
    <div className="space-y-1.5">
      {answers.map((a, i) => (
        <div key={i} className="flex items-center gap-3 text-sm font-mono">
          <span className="text-cyan-300/60 w-12 flex-shrink-0">TTL {a.TTL}</span>
          <span className="text-white/90 break-all flex-1">{a.data}</span>
        </div>
      ))}
    </div>
  );
}

function WhoisResult({ data }) {
  if (!data) return null;
  const fmt = (d) => (d ? new Date(d).toLocaleDateString() : null);
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Domain" value={data.domain} />
        <Field label="Registrar" value={data.registrar} />
        <Field label="Registered" value={fmt(data.registeredOn)} />
        <Field label="Updated" value={fmt(data.updatedOn)} />
        <Field label="Expires" value={fmt(data.expiresOn)} />
      </div>
      {Array.isArray(data.nameservers) && data.nameservers.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wide text-cyan-300/50 mb-1">Nameservers</div>
          <div className="flex flex-wrap gap-1.5">
            {data.nameservers.map((ns, i) => (
              <span key={i} className="text-xs font-mono text-white/80 bg-white/5 px-2 py-0.5 rounded">{ns}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Flag({ label, on, goodWhenOff }) {
  const positive = goodWhenOff ? !on : on;
  return (
    <div className="flex items-center gap-2">
      <span className={`flex items-center justify-center w-5 h-5 rounded-full ${positive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
        {on ? <Check size={12} /> : <Minus size={12} />}
      </span>
      <span className="text-sm text-white/80">{label}</span>
    </div>
  );
}

function EmailResult({ data }) {
  if (!data) return null;
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <Field label="Email" value={data.email} />
        <Field label="Mailbox" value={data.localPart} />
        <Field label="Domain" value={data.domain} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <Flag label="Valid syntax" on={data.validSyntax} />
        <Flag label="Domain accepts mail (MX)" on={data.mxFound} />
        <Flag label="Disposable / throwaway" on={data.disposable} goodWhenOff />
        <Flag label="Role / group address" on={data.role} goodWhenOff />
        <Flag label="Gravatar profile found" on={data.gravatarExists} />
      </div>
      {data.gravatarUrl && (
        <div className="flex items-center gap-3">
          <img src={data.gravatarUrl} alt="Gravatar" className="w-12 h-12 rounded-lg border border-white/10" />
          <a href={data.gravatarUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"><ExternalLink size={12} /> View Gravatar</a>
        </div>
      )}
    </div>
  );
}

function PhoneResult({ data }) {
  if (!data) return null;
  if (!data.valid) {
    return (
      <div>
        <Flag label="Valid phone number" on={false} />
        <p className="text-xs text-white/40 mt-2">{data.reason || 'Number is not valid. Try including the country code, e.g. +1 415 555 2671.'}</p>
      </div>
    );
  }
  const f = data.formats || {};
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <Field label="Country" value={data.countryName ? `${data.countryName} (${data.country})` : data.country} />
        <Field label="Calling code" value={data.callingCode} />
        <Field label="Line type" value={(data.type || 'unknown').replace(/_/g, ' ')} />
        <Field label="National number" value={data.nationalNumber} />
      </div>
      <div className="space-y-1.5">
        <Field label="International" value={f.international} />
        <Field label="National" value={f.national} />
        <Field label="E.164" value={f.e164} />
      </div>
      {f.uri && <a href={f.uri} className="inline-flex items-center gap-1 mt-3 text-xs text-cyan-400 hover:text-cyan-300"><Phone size={12} /> Call</a>}
    </div>
  );
}
