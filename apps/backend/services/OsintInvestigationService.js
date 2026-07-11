/**
 * OsintInvestigationService — AI-directed OSINT investigation.
 *
 * One natural-language query in ("investigate example.com", "look up
 * john@example.com", "who is behind @handle") → entities auto-detected →
 * relevant free lookups (OsintLookups) run in parallel → findings synthesized
 * by Nephesh in Ocean/OSINT mode into an investigator's report. Zero manual
 * tool selection by the user.
 *
 * All lawful, public-source only. Findings + report are returned together so
 * the chat UI can render the report and link the discovered artifacts.
 */

const L = require('./OsintLookups');
const UnifiedAIService = require('./UnifiedAIService');
const attribution = require('../utils/nepheshAttribution');
const { getModePrompt } = require('../prompts/nepheshPrompts');
const logger = require('../utils/logger');

// Pull distinct OSINT entities out of a free-text query. Order matters: email
// before domain (an email contains a domain), so we strip matched emails first.
function detectEntities(query) {
  const q = String(query || '');
  const entities = [];
  const seen = new Set();
  const add = (type, value) => {
    const key = `${type}:${value.toLowerCase()}`;
    if (!seen.has(key)) { seen.add(key); entities.push({ type, value }); }
  };

  let rest = q;

  // Emails
  (rest.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g) || []).forEach((m) => {
    if (L.RE.email.test(m)) { add('email', m); rest = rest.replace(m, ' '); }
  });
  // IPv4
  (rest.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []).forEach((m) => {
    if (L.RE.ip.test(m)) { add('ip', m); rest = rest.replace(m, ' '); }
  });
  // Domains (strip protocol/path first)
  (rest.match(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi) || []).forEach((m) => {
    const d = m.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (L.RE.domain.test(d)) { add('domain', d); }
  });
  // Phone (E.164-ish, needs a leading +)
  (rest.match(/\+\d[\d\s().-]{6,}\d/g) || []).forEach((m) => {
    if (L.RE.phone.test(m.trim())) { add('phone', m.trim()); }
  });
  // Explicit @handle or "username X"
  (rest.match(/(?:^|\s)@([a-z0-9_.-]{2,39})\b/gi) || []).forEach((m) => {
    const h = m.replace(/[@\s]/g, '');
    if (L.RE.username.test(h)) add('username', h);
  });
  const named = rest.match(/\busername[:\s]+([a-z0-9_.-]{2,39})\b/i);
  if (named && L.RE.username.test(named[1])) add('username', named[1]);

  return entities;
}

// Run the lookups appropriate to each detected entity, in parallel.
async function gather(entities) {
  const findings = [];
  await Promise.all(
    entities.map(async (ent) => {
      const f = { entity: ent, data: {} };
      try {
        if (ent.type === 'domain') {
          const [whois, dns, ct, wb] = await Promise.all([
            L.whois(ent.value), L.dns(ent.value), L.certTransparency(ent.value), L.wayback(ent.value),
          ]);
          f.data = { whois, dns, certTransparency: ct, wayback: wb };
        } else if (ent.type === 'ip') {
          f.data = { ipGeo: await L.ipGeo(ent.value) };
        } else if (ent.type === 'email') {
          f.data = { emailIntel: await L.emailIntel(ent.value) };
        } else if (ent.type === 'phone') {
          f.data = { phoneIntel: L.phoneIntel(ent.value) };
        } else if (ent.type === 'username') {
          f.data = { usernameCheck: await L.usernameCheck(ent.value) };
        }
      } catch (e) {
        logger.warn('osint gather error:', { entity: ent, error: e.message });
      }
      findings.push(f);
    })
  );
  return findings;
}

// Pull the clickable artifacts out of findings so the chat can render them as
// citation chips (same shape as search citations: { links: [...] }).
function extractArtifacts(findings) {
  const links = [];
  const push = (title, url) => { if (url) links.push({ title, url, domain: safeDomain(url) }); };
  for (const f of findings) {
    const d = f.data;
    (d.certTransparency?.subdomains || []).slice(0, 10).forEach((s) => push(`subdomain: ${s}`, `https://${s}`));
    if (d.wayback?.archived) push('Wayback snapshot', d.wayback.snapshot);
    (d.usernameCheck?.results || []).filter((r) => r.found && r.profile).forEach((r) => push(`${r.platform} profile`, r.profile));
    if (d.emailIntel?.gravatarUrl) push('Gravatar avatar', d.emailIntel.gravatarUrl);
  }
  return links;
}

function safeDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

async function synthesize(query, findings) {
  const system = `${getModePrompt('ocean')}

ACTIVE TASK: OSINT INVESTIGATION REPORT. You are given structured findings
gathered from free, public OSINT sources for the user's query. Write a concise
investigator's report with these sections:
## Summary — what was asked and the headline findings in 2-3 sentences.
## Findings — per entity, the concrete facts discovered (registrar, dates,
nameservers, subdomains, geolocation, MX/deliverability, confirmed profiles,
archive presence). State clearly when a source returned nothing.
## Leads & Next Steps — the next logical, lawful investigative moves.
Rules: report only what the findings support — never invent registrants,
owners, or identities the data does not show. Flag gaps explicitly. Only ever
assist with lawful research on publicly available information.`;

  const corpus = `INVESTIGATION QUERY: ${query}

GATHERED FINDINGS (JSON):
${JSON.stringify(findings, null, 2)}`;

  const order = ['nephesh', ...UnifiedAIService.getAvailableProviders()].filter((n, i, a) => a.indexOf(n) === i);
  let lastError = null;
  for (const name of order) {
    const provider = UnifiedAIService.getProvider(name);
    if (!provider || !provider.isAvailable?.()) continue;
    try {
      const resp = await UnifiedAIService.callProvider(name, [{ role: 'user', content: corpus }], {
        system,
        mode: 'ocean',
        temperature: 0.3,
        max_tokens: 2000,
      });
      return attribution.stampResponse({ ...resp, provider: name });
    } catch (e) {
      lastError = e;
      logger.warn(`osint synthesis provider ${name} failed:`, e.message);
    }
  }
  throw new Error(`OSINT synthesis failed. Last error: ${lastError?.message}`);
}

async function investigate(query) {
  const entities = detectEntities(query);
  if (entities.length === 0) {
    return { entities: [], findings: [], report: null, noEntities: true };
  }
  const findings = await gather(entities);
  const response = await synthesize(query, findings);
  return {
    entities,
    findings,
    artifacts: extractArtifacts(findings),
    report: response.content,
    provider: response.provider,
    nephesh_attribution: response.nephesh_attribution,
  };
}

module.exports = { investigate, detectEntities, gather, extractArtifacts };
