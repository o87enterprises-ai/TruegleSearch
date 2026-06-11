import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, Shield, AtSign, Search, Loader2, ExternalLink, X, MapPin,
} from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const TOOLS = [
  { id: 'ip', label: 'IP Lookup', icon: MapPin, placeholder: 'e.g. 8.8.8.8', hint: 'Geolocate an IPv4 address' },
  { id: 'dns', label: 'DNS', icon: Server, placeholder: 'e.g. example.com', hint: 'Resolve DNS records' },
  { id: 'whois', label: 'WHOIS', icon: Shield, placeholder: 'e.g. example.com', hint: 'Domain registration details' },
  { id: 'username', label: 'Username', icon: AtSign, placeholder: 'e.g. johndoe', hint: 'Find profiles across platforms' },
];

const DNS_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA'];

/**
 * OSINT tools panel for Ocean mode. Wires the free, no-key backend recon
 * endpoints (ip-lookup, dns-lookup, whois, username-platforms) with per-tool
 * input forms and an in-page iframe verification panel (X-Frame-aware).
 */
export default function OSINTToolsPanel() {
  const [tool, setTool] = useState('ip');
  const [input, setInput] = useState('');
  const [dnsType, setDnsType] = useState('A');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewBlocked, setPreviewBlocked] = useState(false);

  const active = TOOLS.find((t) => t.id === tool);

  const switchTool = (id) => {
    setTool(id);
    setInput('');
    setResult(null);
    setError(null);
  };

  const run = async (e) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let url;
      if (tool === 'ip') url = `${BACKEND}/api/osint/ip-lookup?ip=${encodeURIComponent(q)}`;
      else if (tool === 'dns') url = `${BACKEND}/api/osint/dns-lookup?domain=${encodeURIComponent(q)}&type=${dnsType}`;
      else if (tool === 'whois') url = `${BACKEND}/api/osint/whois?domain=${encodeURIComponent(q)}`;
      else url = `${BACKEND}/api/osint/username-platforms?username=${encodeURIComponent(q)}`;

      const resp = await fetch(url);
      const json = await resp.json();
      if (!resp.ok || json.error) throw new Error(json.error || 'Lookup failed');
      setResult({ tool, ...json });
    } catch (err) {
      setError(err.message || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const openPreview = (u) => { setPreviewUrl(u); setPreviewBlocked(false); };

  return (
    <div className="max-w-4xl mx-auto mb-6 p-5 rounded-2xl bg-gradient-to-br from-[#0a1f33]/95 to-[#001020]/95 backdrop-blur-2xl border-2 border-cyan-500/40 shadow-lg shadow-cyan-500/10">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={16} className="text-cyan-400" />
        <h3 className="text-base font-semibold text-white">OSINT Tools</h3>
        <span className="text-xs text-cyan-300/50">free recon · no key required</span>
      </div>

      {/* Tool tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => switchTool(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tool === t.id
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/50'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Input form */}
      <form onSubmit={run} className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 border border-cyan-500/20 focus-within:border-cyan-500/50 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={active.placeholder}
            className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm focus:outline-none"
          />
        </div>
        {tool === 'dns' && (
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
          disabled={loading || !input.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-[#001020] text-sm font-semibold transition-colors"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          Run
        </button>
      </form>
      <p className="text-xs text-white/30 mt-1.5">{active.hint}</p>

      {/* Error */}
      {error && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Results */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={`${result.tool}-${JSON.stringify(result).length}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            {result.tool === 'ip' && <IpResult data={result.data} />}
            {result.tool === 'dns' && <DnsResult data={result.data} />}
            {result.tool === 'whois' && <WhoisResult data={result.data} />}
            {result.tool === 'username' && (
              <UsernameResult platforms={result.platforms} onPreview={openPreview} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-page iframe verification panel */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 rounded-xl overflow-hidden border border-cyan-500/20"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-black/50 border-b border-white/5">
              <span className="text-xs text-cyan-300/70 truncate flex-1 mr-2">{previewUrl}</span>
              <div className="flex gap-2 flex-shrink-0">
                <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                  <ExternalLink size={11} /> Open link
                </a>
                <button onClick={() => setPreviewUrl(null)} className="text-xs text-white/30 hover:text-white">
                  <X size={14} />
                </button>
              </div>
            </div>
            {previewBlocked ? (
              <div className="flex flex-col items-center justify-center py-8 bg-black/20 gap-2">
                <p className="text-sm text-white/50 text-center px-4">This page can't be embedded (X-Frame-Options).</p>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                  <ExternalLink size={12} /> Open in new tab
                </a>
              </div>
            ) : (
              <iframe
                key={previewUrl}
                src={previewUrl}
                className="w-full h-[55vh] bg-white"
                title="OSINT verification preview"
                sandbox="allow-scripts allow-same-origin"
                onLoad={(e) => {
                  try {
                    if (!e.target.contentDocument || e.target.contentDocument.body?.innerHTML === '')
                      setPreviewBlocked(true);
                  } catch { setPreviewBlocked(true); }
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Result renderers ──────────────────────────────────────────────────────────

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
    <div className="rounded-xl bg-black/30 border border-white/10 p-4">
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
      </div>
      {mapsUrl && (
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-xs text-cyan-400 hover:text-cyan-300">
          <MapPin size={12} /> View on map
        </a>
      )}
    </div>
  );
}

function DnsResult({ data }) {
  const answers = data?.Answer || [];
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 p-4">
      {answers.length === 0 ? (
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
      )}
    </div>
  );
}

function WhoisResult({ data }) {
  if (!data) return null;
  const fmt = (d) => (d ? new Date(d).toLocaleDateString() : null);
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 p-4">
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
      {Array.isArray(data.status) && data.status.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.status.map((s, i) => (
            <span key={i} className="text-[11px] text-cyan-300/70 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function UsernameResult({ platforms, onPreview }) {
  if (!platforms || platforms.length === 0) return null;
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 p-4">
      <p className="text-xs text-white/40 mb-3">
        {platforms.length} platforms · click <span className="text-cyan-300">Verify</span> to preview in-page, or open the profile directly.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {platforms.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
            <div className="min-w-0">
              <div className="text-sm text-white/90 truncate">{p.name}</div>
              <div className="text-[11px] text-white/30 truncate">{p.url}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => onPreview(p.url)} className="text-xs text-cyan-400 hover:text-cyan-300">Verify</button>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white">
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
