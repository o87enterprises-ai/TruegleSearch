/**
 * OsintGraphService — represents an OSINT investigation as a GRAPH of typed
 * nodes and edges, modeled on GraphiPy (github.com/shobeir/GraphiPy).
 *
 * GraphiPy's contract, mirrored here:
 *   - BaseNode(_id, label, label_attribute) → fields Id, Label, and a type
 *     ("label_attribute"). Nodes are stored by type then by Id so duplicates
 *     collapse.
 *   - BaseEdge(source, target, label) → fields Source, Target, Label, and an
 *     Id that is the concatenation of source + target + label.
 *   - BaseGraph.create_node / create_edge / get_nodes / get_edges /
 *     export_csv(prefix).
 *
 * We keep GraphiPy's exact field names (Id/Label/Source/Target) so the CSV
 * export drops straight into Gephi, and add a JSON export for the in-app graph
 * view. An investigation naturally forms an entity-relationship graph: the
 * query links to each detected entity, and each entity links to the artifacts
 * discovered about it.
 */

// ---- GraphiPy-style primitives -------------------------------------------

class Node {
  constructor(id, label, type, attributes = {}) {
    this.Id = String(id);
    this.Label = label == null ? String(id) : String(label);
    this.Type = type || 'node'; // GraphiPy's "label_attribute"
    this.attributes = attributes;
  }
}

class Edge {
  constructor(source, target, label) {
    this.Source = String(source);
    this.Target = String(target);
    this.Label = label || 'related_to';
    // GraphiPy: Id is the concatenation of source, target, and label.
    this.Id = `${this.Source}|${this.Label}|${this.Target}`;
  }
}

class Graph {
  constructor() {
    // { type: { id: Node } } and { label: { id: Edge } } — dedupe by id.
    this._nodes = {};
    this._edges = {};
  }

  createNode(node) {
    const bucket = (this._nodes[node.Type] = this._nodes[node.Type] || {});
    if (!bucket[node.Id]) bucket[node.Id] = node;
    else Object.assign(bucket[node.Id].attributes, node.attributes); // merge new attrs onto existing
    return bucket[node.Id];
  }

  createEdge(edge) {
    const bucket = (this._edges[edge.Label] = this._edges[edge.Label] || {});
    if (!bucket[edge.Id]) bucket[edge.Id] = edge;
    return bucket[edge.Id];
  }

  getNodes() {
    return Object.values(this._nodes).flatMap((byId) => Object.values(byId));
  }

  getEdges() {
    return Object.values(this._edges).flatMap((byId) => Object.values(byId));
  }

  /** Plain JSON for the API / frontend graph view. */
  toJSON() {
    return {
      nodes: this.getNodes().map((n) => ({ id: n.Id, label: n.Label, type: n.Type, ...n.attributes })),
      edges: this.getEdges().map((e) => ({ id: e.Id, source: e.Source, target: e.Target, label: e.Label })),
    };
  }

  /** Gephi-ready CSVs (nodes: Id,Label,Type · edges: Source,Target,Label,Id). */
  exportCsv() {
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const nodesCsv = ['Id,Label,Type']
      .concat(this.getNodes().map((n) => [n.Id, n.Label, n.Type].map(esc).join(',')))
      .join('\n');
    const edgesCsv = ['Source,Target,Label,Id']
      .concat(this.getEdges().map((e) => [e.Source, e.Target, e.Label, e.Id].map(esc).join(',')))
      .join('\n');
    return { nodesCsv, edgesCsv };
  }
}

// ---- Investigation → graph ------------------------------------------------

function safeDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

// Each entity type contributes its findings as artifact nodes + a labeled edge.
// [findingPath, nodeType, edgeLabel, mapper] — mapper turns a finding row into
// { id, label, attrs } (or null to skip).
function artifactsFor(entityId, data, add) {
  // domain
  (data.certTransparency?.subdomains || []).slice(0, 15).forEach((s) =>
    add(entityId, `https://${s}`, s, 'subdomain', 'has_subdomain'));
  if (data.whois?.registrar) add(entityId, `registrar:${data.whois.registrar}`, data.whois.registrar, 'registrar', 'registered_via');
  (data.whois?.registrantOrg ? [data.whois.registrantOrg] : []).forEach((org) =>
    add(entityId, `org:${org}`, org, 'organization', 'registered_to'));
  (data.dns?.records || data.dns?.a || []).slice(0, 10).forEach((rec) => {
    const val = typeof rec === 'string' ? rec : rec.value || rec.data;
    if (val) add(entityId, `dns:${val}`, val, 'dns_record', 'resolves_to');
  });
  if (data.wayback?.snapshot) add(entityId, data.wayback.snapshot, 'Wayback snapshot', 'archive', 'archived_at');
  // ip
  if (data.ipGeo?.org) add(entityId, `asn:${data.ipGeo.org}`, data.ipGeo.org, 'network', 'hosted_by');
  if (data.ipGeo?.city || data.ipGeo?.country) {
    const loc = [data.ipGeo.city, data.ipGeo.country].filter(Boolean).join(', ');
    add(entityId, `geo:${loc}`, loc, 'location', 'geolocated_to');
  }
  // email
  if (data.emailIntel?.gravatarUrl) add(entityId, data.emailIntel.gravatarUrl, 'Gravatar', 'avatar', 'has_avatar');
  (data.emailIntel?.mxProvider ? [data.emailIntel.mxProvider] : []).forEach((mx) =>
    add(entityId, `mx:${mx}`, mx, 'mail_provider', 'mail_handled_by'));
  // username
  (data.usernameCheck?.results || []).filter((r) => r.found && r.profile).forEach((r) =>
    add(entityId, r.profile, `${r.platform}`, 'profile', 'profile_on'));
  // person / phone — public directory deep links
  // Gravatar is a person's own profile, so its linked accounts are asserted by
  // the subject rather than guessed by us — worth their own edge label.
  if (data.gravatar?.found) add(entityId, data.gravatar.profileUrl, 'Gravatar profile', 'profile', 'has_profile');
  (data.gravatar?.accounts || []).forEach((a) => add(entityId, a.url, `${a.platform || 'linked account'}${a.username ? ` (${a.username})` : ''}`, 'profile', 'self_linked'));
  (data.gravatar?.urls || []).forEach((u) => add(entityId, u, 'Site on Gravatar profile', 'site', 'self_linked'));
  (data.githubByEmail?.users || []).forEach((u) => add(entityId, u.profile, `GitHub: ${u.login}`, 'profile', 'commits_as'));
  (data.peopleSearch?.links || []).forEach((l) => add(entityId, l.url, l.name, 'directory', 'listed_in'));
  (data.phoneSearch?.links || []).forEach((l) => add(entityId, l.url, l.name, 'directory', 'listed_in'));
}

/**
 * Build an investigation graph from the detected entities + gathered findings.
 * @param {string} query
 * @param {Array<{type,value,city?,state?}>} entities
 * @param {Array<{entity,data}>} findings
 * @returns {Graph}
 */
function buildFromInvestigation(query, entities, findings) {
  const g = new Graph();
  const qLabel = (query || '').trim().slice(0, 120) || 'investigation';
  const qId = 'query:root';
  g.createNode(new Node(qId, qLabel, 'query'));

  for (const ent of entities || []) {
    const entId = `${ent.type}:${ent.value}`;
    const attrs = {};
    if (ent.city) attrs.city = ent.city;
    if (ent.state) attrs.state = ent.state;
    g.createNode(new Node(entId, ent.value, ent.type, attrs));
    g.createEdge(new Edge(qId, entId, 'investigates'));
  }

  const add = (sourceId, artId, label, type, edgeLabel) => {
    if (!artId) return;
    g.createNode(new Node(artId, label, type, /^https?:\/\//i.test(artId) ? { url: artId, domain: safeDomain(artId) } : {}));
    g.createEdge(new Edge(sourceId, artId, edgeLabel));
  };

  for (const f of findings || []) {
    if (!f || !f.entity) continue;
    const entId = `${f.entity.type}:${f.entity.value}`;
    artifactsFor(entId, f.data || {}, add);
  }

  return g;
}

module.exports = {
  Graph,
  Node,
  Edge,
  buildFromInvestigation,
};
