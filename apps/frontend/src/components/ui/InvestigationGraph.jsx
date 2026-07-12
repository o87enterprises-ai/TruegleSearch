import { useMemo, useState } from 'react';
import { Download, Share2, Network } from 'lucide-react';

// Node-type → color, keeping the OSINT/ocean palette. Query is the root; the
// entity types match the backend detector; the rest are discovered artifacts.
const TYPE_COLOR = {
  query: '#e5e7eb',
  domain: '#22d3ee', ip: '#38bdf8', email: '#34d399', username: '#a78bfa', phone: '#f472b6', person: '#fbbf24',
  subdomain: '#0ea5e9', organization: '#facc15', registrar: '#fcd34d', dns_record: '#5eead4',
  archive: '#94a3b8', network: '#7dd3fc', location: '#fca5a5', avatar: '#6ee7b7',
  mail_provider: '#4ade80', profile: '#c4b5fd', directory: '#fdba74',
};
const colorFor = (t) => TYPE_COLOR[t] || '#9ca3af';

const ENTITY_TYPES = new Set(['domain', 'ip', 'email', 'username', 'phone', 'person']);
const MAX_ARTIFACTS = 40; // keep the SVG readable; note the remainder

function download(name, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

/**
 * Visual investigation graph — a three-column layered view (query → entities →
 * discovered artifacts) with curved edges, built from the GraphiPy-style
 * {nodes, edges} the backend returns. Exports Gephi-ready CSV and JSON.
 */
export default function InvestigationGraph({ graph, accent }) {
  const [open, setOpen] = useState(true);

  const model = useMemo(() => {
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph?.edges) ? graph.edges : [];
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const queryNodes = nodes.filter((n) => n.type === 'query');
    const entityNodes = nodes.filter((n) => ENTITY_TYPES.has(n.type));
    const artifactNodesAll = nodes.filter((n) => n.type !== 'query' && !ENTITY_TYPES.has(n.type));
    const artifactNodes = artifactNodesAll.slice(0, MAX_ARTIFACTS);
    const shownIds = new Set([...queryNodes, ...entityNodes, ...artifactNodes].map((n) => n.id));

    // Layout: 3 columns, evenly spaced vertically within each column.
    const COL_X = { query: 70, entity: 300, artifact: 560 };
    const ROW_H = 34;
    const place = (list, x) => {
      const total = Math.max(list.length, 1);
      const height = total * ROW_H;
      return list.map((n, i) => ({ ...n, x, y: (i + 0.5) * (height / total) }));
    };
    const q = place(queryNodes, COL_X.query);
    const e = place(entityNodes, COL_X.entity);
    const a = place(artifactNodes, COL_X.artifact);
    const positioned = [...q, ...e, ...a];
    const pos = new Map(positioned.map((n) => [n.id, n]));

    const svgEdges = edges
      .filter((ed) => pos.has(ed.source) && pos.has(ed.target))
      .filter((ed) => shownIds.has(ed.source) && shownIds.has(ed.target))
      .map((ed) => ({ ...ed, s: pos.get(ed.source), t: pos.get(ed.target) }));

    const height = Math.max(q.length, e.length, a.length, 1) * ROW_H + 20;
    return {
      nodes, edges, byId, positioned, svgEdges, height,
      hiddenCount: artifactNodesAll.length - artifactNodes.length,
      counts: { entities: entityNodes.length, artifacts: artifactNodesAll.length },
    };
  }, [graph]);

  if (!graph || !model.nodes.length) return null;

  const exportCsv = () => {
    const nodesCsv = toCsv([['Id', 'Label', 'Type'], ...model.nodes.map((n) => [n.id, n.label, n.type])]);
    const edgesCsv = toCsv([['Source', 'Target', 'Label', 'Id'], ...model.edges.map((e) => [e.source, e.target, e.label, e.id])]);
    download('investigation-nodes.csv', nodesCsv, 'text/csv');
    download('investigation-edges.csv', edgesCsv, 'text/csv');
  };
  const exportJson = () => download('investigation-graph.json', JSON.stringify(graph, null, 2), 'application/json');

  const W = 640;

  return (
    <div className={`mt-3 rounded-xl border ${accent?.iframeBorder || 'border-cyan-500/20'} bg-black/30 overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <Network size={13} className={accent?.count || 'text-cyan-300'} />
        <span className="text-xs font-medium text-white/80">Investigation graph</span>
        <span className="text-[10px] text-white/40">
          {model.counts.entities} entities · {model.counts.artifacts} findings
        </span>
        <span className="ml-auto text-[10px] text-white/40">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="px-2 pb-2">
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${model.height}`} className="w-full" style={{ minWidth: 520, height: Math.min(model.height, 520) }}>
              {model.svgEdges.map((ed) => {
                const midX = (ed.s.x + ed.t.x) / 2;
                return (
                  <path
                    key={ed.id}
                    d={`M ${ed.s.x} ${ed.s.y} C ${midX} ${ed.s.y}, ${midX} ${ed.t.y}, ${ed.t.x} ${ed.t.y}`}
                    fill="none"
                    stroke="rgba(255,255,255,0.14)"
                    strokeWidth="1"
                  />
                );
              })}
              {model.positioned.map((n) => {
                const c = colorFor(n.type);
                const label = (n.label || n.id).slice(0, 34);
                const isArtifactLink = n.url;
                const content = (
                  <g>
                    <circle cx={n.x} cy={n.y} r={n.type === 'query' ? 6 : 4.5} fill={c} opacity={0.9} />
                    <text
                      x={n.x + 9}
                      y={n.y + 3}
                      fontSize="10"
                      fill={n.type === 'query' ? '#fff' : 'rgba(255,255,255,0.75)'}
                      className={isArtifactLink ? 'underline' : ''}
                    >
                      {label}
                    </text>
                  </g>
                );
                return isArtifactLink ? (
                  <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer">{content}</a>
                ) : (
                  <g key={n.id}>{content}</g>
                );
              })}
            </svg>
          </div>

          {model.hiddenCount > 0 && (
            <div className="text-[10px] text-white/40 px-1 pb-1">+{model.hiddenCount} more findings in the CSV/JSON export</div>
          )}

          <div className="flex items-center gap-2 px-1 pt-1">
            <button type="button" onClick={exportCsv} className={`flex items-center gap-1 text-[11px] ${accent?.link || 'text-cyan-300'} hover:opacity-80`}>
              <Download size={11} /> CSV (Gephi)
            </button>
            <button type="button" onClick={exportJson} className={`flex items-center gap-1 text-[11px] ${accent?.link || 'text-cyan-300'} hover:opacity-80`}>
              <Share2 size={11} /> JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
