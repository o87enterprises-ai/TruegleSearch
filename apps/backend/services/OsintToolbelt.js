/**
 * OsintToolbelt — the lookups, made reachable by the AI.
 *
 * THE COMPLAINT THIS ANSWERS: "it shouldn't be telling users to look up a
 * source it can easily look up itself."
 *
 * It was right, and the cause was not the prompt. Truegle already has real
 * OSINT lookups — RDAP whois, DNS, IP geolocation, email deliverability,
 * offline phone parsing, certificate transparency, username presence, Wayback
 * — all free, all keyless, all working. They were only reachable by a person
 * clicking /osint. The assistant had no way to call any of them, so when
 * someone asked about a domain it did the only thing it could: describe how
 * they might find out.
 *
 * This runs them and hands the results back as SOURCES. The model then has
 * facts to ground on instead of advice to give.
 *
 * WHAT IS DELIBERATELY NOT HERE. Most of the public OSINT indexes cannot be
 * called from a server at all: they are browser-only apps, they need their own
 * key, or they block datacenter IPs outright. Wrapping two hundred of those
 * would produce a toolbelt that mostly returns errors. These are the ones that
 * demonstrably answer, and each is bounded by a timeout so a slow one cannot
 * hold up an answer.
 */
const logger = require('../utils/logger');

// LAZY, and it has to stay that way. OsintInvestigationService requires
// UnifiedAIService (to write its report), UnifiedAIService requires this file,
// and a top-level require closes that loop — leaving detectEntities and gather
// as `undefined` depending on which module the process happened to load first.
// That fails SILENTLY, as "no entities detected", which is the worst possible
// shape for a bug like this. Resolving them at call time breaks the cycle
// without either side having to know about the other's load order.
const investigation = () => require('./OsintInvestigationService'); // eslint-disable-line global-require

// A whole toolbelt run has to fit inside a chat response. Better a partial set
// of findings than a request that times out with none.
const BUDGET_MS = 9000;

const trim = (v, n = 220) => (typeof v === 'string' && v.length > n ? `${v.slice(0, n)}…` : v);

// Each entity type renders to plain lines. Plain text on purpose: a model
// grounds far better on "Registrar: Cloudflare" than on nested JSON, and the
// lines are quotable in an answer as they stand.
const RENDER = {
  domain(d) {
    const out = [];
    const w = d.whois;
    if (w?.ok) {
      out.push(`Registrar: ${w.registrar || 'unknown'}`);
      if (w.registeredOn) out.push(`Registered: ${w.registeredOn}`);
      if (w.expiresOn) out.push(`Expires: ${w.expiresOn}`);
      if (w.status?.length) out.push(`Status: ${w.status.slice(0, 4).join(', ')}`);
      if (w.nameservers?.length) out.push(`Nameservers: ${w.nameservers.slice(0, 4).join(', ')}`);
    } else if (w) out.push(`WHOIS: no record returned (${trim(w.error, 80)})`);

    const dns = d.dns;
    if (dns?.ok) {
      for (const t of ['A', 'AAAA', 'MX', 'NS', 'TXT']) {
        const recs = dns[t] || dns.records?.[t];
        if (Array.isArray(recs) && recs.length) out.push(`${t}: ${recs.slice(0, 4).map((r) => trim(typeof r === 'string' ? r : r.data || r.value, 90)).join(', ')}`);
      }
    }
    const ct = d.certTransparency;
    if (ct?.ok) {
      if (typeof ct.count === 'number') out.push(`Certificates logged: ${ct.count}`);
      if (ct.subdomains?.length) out.push(`Subdomains seen in CT logs: ${ct.subdomains.slice(0, 12).join(', ')}`);
    }
    const wb = d.wayback;
    if (wb?.ok && wb.first) out.push(`First archived: ${wb.first}${wb.last ? `, last archived: ${wb.last}` : ''}`);
    return out;
  },

  ip(d) {
    const g = d.ipGeo;
    if (!g?.ok) return g ? [`IP lookup failed: ${trim(g.error, 80)}`] : [];
    return [
      g.org && `Network: ${g.org}`,
      g.asn && `ASN: ${g.asn}`,
      [g.city, g.region, g.country].filter(Boolean).length && `Location: ${[g.city, g.region, g.country].filter(Boolean).join(', ')}`,
      g.hosting !== undefined && `Hosting/datacenter: ${g.hosting ? 'yes' : 'no'}`,
      g.proxy !== undefined && `Proxy/VPN flagged: ${g.proxy ? 'yes' : 'no'}`,
    ].filter(Boolean);
  },

  email(d) {
    const e = d.emailIntel;
    if (!e?.ok) return e ? [`Email check failed: ${trim(e.error, 80)}`] : [];
    return [
      e.valid !== undefined && `Address is syntactically valid: ${e.valid ? 'yes' : 'no'}`,
      e.mx !== undefined && `Domain accepts mail (MX present): ${e.mx ? 'yes' : 'no'}`,
      e.disposable !== undefined && `Disposable provider: ${e.disposable ? 'yes' : 'no'}`,
      e.freeProvider !== undefined && `Free provider: ${e.freeProvider ? 'yes' : 'no'}`,
      e.domain && `Mail domain: ${e.domain}`,
    ].filter(Boolean);
  },

  phone(d) {
    const p = d.phoneIntel;
    if (!p?.ok) return p ? [`Phone parse failed: ${trim(p.error, 80)}`] : [];
    return [
      p.valid !== undefined && `Valid number: ${p.valid ? 'yes' : 'no'}`,
      p.country && `Country: ${p.country}`,
      p.type && `Line type: ${p.type}`,
      p.carrier && `Carrier: ${p.carrier}`,
      p.e164 && `E.164: ${p.e164}`,
    ].filter(Boolean);
  },

  username(d) {
    const u = d.usernameCheck;
    if (!u) return [];
    const found = (u.found || u.results || []).filter((r) => r.exists || r.found);
    if (!found.length) return ['No public profiles found on the sites checked.'];
    return [`Profiles found on: ${found.map((r) => r.site || r.name).filter(Boolean).slice(0, 15).join(', ')}`];
  },

  person(d) {
    const l = d.peopleSearch;
    if (!Array.isArray(l) || !l.length) return [];
    // These are LINKS, not findings. Saying so matters: the model must not
    // report the existence of a search URL as evidence a person was found.
    return [`Public records searches available (not yet run): ${l.slice(0, 6).map((x) => x.name || x.label).filter(Boolean).join(', ')}`];
  },
};

/**
 * Run every lookup that applies to the entities in a question.
 * @returns {{ran: boolean, entities: string[], text: string}}
 */
async function run(queryText) {
  let entities = [];
  try {
    entities = investigation().detectEntities(String(queryText || ''));
  } catch (err) {
    logger.warn('osint entity detection failed', { error: err.message });
    return { ran: false, entities: [], text: '' };
  }
  if (!entities.length) return { ran: false, entities: [], text: '' };

  let findings = [];
  try {
    findings = await Promise.race([
      investigation().gather(entities),
      new Promise((res) => { setTimeout(() => res([]), BUDGET_MS); }),
    ]);
  } catch (err) {
    logger.warn('osint gather failed', { error: err.message });
    return { ran: false, entities: entities.map((e) => `${e.type}:${e.value}`), text: '' };
  }
  if (!findings.length) return { ran: false, entities: entities.map((e) => `${e.type}:${e.value}`), text: '' };

  const blocks = [];
  for (const f of findings) {
    const render = RENDER[f.entity?.type];
    const lines = render ? render(f.data || {}) : [];
    if (!lines.length) continue;
    blocks.push(`### ${f.entity.type.toUpperCase()}: ${f.entity.value}\n${lines.map((l) => `- ${l}`).join('\n')}`);
  }
  if (!blocks.length) return { ran: false, entities: entities.map((e) => `${e.type}:${e.value}`), text: '' };

  const text = [
    'LIVE LOOKUP RESULTS (run just now by Truegle against public records — treat these as primary sources):',
    '',
    ...blocks,
    '',
    'These were retrieved directly. Report what they say. Do not tell the user to look any of this up themselves — it has already been done. Where a field is absent, say it is absent rather than guessing.',
  ].join('\n');

  logger.info('OSINT toolbelt ran', { entities: entities.length, blocks: blocks.length, chars: text.length });
  return { ran: true, entities: entities.map((e) => `${e.type}:${e.value}`), text };
}

/** Is there anything here worth looking up? Cheap — no network. */
function hasEntities(queryText) {
  try {
    return investigation().detectEntities(String(queryText || '')).length > 0;
  } catch {
    return false;
  }
}

module.exports = { run, hasEntities, RENDER };
