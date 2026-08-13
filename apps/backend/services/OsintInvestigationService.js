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
const OsintGraph = require('./OsintGraphService');
const UnifiedAIService = require('./UnifiedAIService');
const attribution = require('../utils/nepheshAttribution');
const { getModePrompt } = require('../prompts/nepheshPrompts');
const logger = require('../utils/logger');

// Pull distinct OSINT entities out of a free-text query. Order matters: email
// before domain (an email contains a domain), so we strip matched emails first.
// Punctuation that can sit against an entity in ordinary prose but is never
// part of it. Applied to every extracted value, because the same class of bug
// (a captured comma) turns a real address into a fake one and a real name into
// ", Odin ...".
const trimEdges = (v) => String(v || '').replace(/^[\s,;:.'"“”‘’()[\]<>]+/, '').replace(/[\s,;:.'"“”‘’()[\]<>]+$/, '');

function detectEntities(query) {
  const q = String(query || '');
  const entities = [];
  const seen = new Set();

  let rest = q;

  // Emails
  //
  // TRAILING PUNCTUATION IS NOT PART OF THE ADDRESS. `[^\s@]+` happily eats the
  // comma in "me@gmail.com, 555-1234", which produced the address
  // "me@gmail.com," — whose DOMAIN is then "gmail.com,", which naturally has no
  // MX record. The debrief duly reported "No MX" for a Gmail address, and the
  // model went on to infer the user had supplied false contact details. A
  // stray comma became an accusation, so trim the edges before validating.
  (rest.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g) || []).forEach((raw) => {
    const m = trimEdges(raw);
    if (L.RE.email.test(m)) { add('email', m); rest = rest.replace(raw, ' '); }
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
  // Phone: E.164 (+…) OR a bare North-American number (10 digits, or 11 with a
  // leading 1), allowing separators. Strip matched phones so their digits
  // don't get re-read as ages/DOBs below.
  (rest.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\+\d[\d\s().-]{6,}\d/g) || []).forEach((m) => {
    const d = m.replace(/\D/g, '');
    if (d.length === 10 || (d.length === 11 && d.startsWith('1')) || (m.trim().startsWith('+') && d.length >= 8)) {
      add('phone', trimEdges(m));
      rest = rest.replace(m, ' ');
    }
  });
  // Explicit @handle or "username X"
  (rest.match(/(?:^|\s)@([a-z0-9_.-]{2,39})\b/gi) || []).forEach((m) => {
    const h = m.replace(/[@\s]/g, '');
    if (L.RE.username.test(h)) add('username', h);
  });
  const namedUser = rest.match(/\busername[:\s]+([a-z0-9_.-]{2,39})\b/i);
  if (namedUser && L.RE.username.test(namedUser[1])) add('username', namedUser[1]);

  // Person: a capitalized full name (2-4 words), emitted only when the query
  // shows person-lookup intent — an explicit verb (find/look up/gather info
  // about/who is), OR the name appears alongside a phone / age / DOB / location
  // (the classic people-search context). This keeps "New York Times" etc. from
  // being treated as a person. Public-records people-search is a lawful task.
  const personEntity = detectPerson(q);
  if (personEntity) {
    const name = trimEdges(personEntity.name);
    // A name that trims to nothing (or to a single stray letter) was never a
    // name — it was punctuation the matcher grabbed.
    if (name.length >= 3) add('person', name, { ...personEntity, name });
  }

  return entities;

  // add() closure supports optional meta for the person entity
  function add(type, value, meta) {
    const key = `${type}:${String(value).toLowerCase()}`;
    if (!seen.has(key)) { seen.add(key); entities.push(meta ? { type, value, ...meta } : { type, value }); }
  }
}

// Extract a probable person (name + optional city/state) from a people-search
// query. Returns null when there's no clear person-lookup signal. Tolerant of
// the sloppy casing real queries use ("william James gardener").
const NAME_STOP = /^(the|a|an|his|her|their|any|some|about|on|for|of|to|and|with|info|information|publicly|available|approx|approximately|age|years|old|dob|born|phone|number|who|is|named|name)$/i;
// Whole-word context markers (NOT prefix — "Jane" must not match month "jan",
// "Marcus" must not match "mar"). Digit/`+`-leading tokens are handled separately.
const CONTEXT_KW = /^(age|years?|approx|approximately|dob|born|lives?|resides?|from|in|phone|feb|jan|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)$/i;
const isContextToken = (w) => /^[\d+]/.test(w) || CONTEXT_KW.test(w);
const TITLE = (s) => s.replace(/\b([a-z])([a-z']*)/gi, (_, a, b) => a.toUpperCase() + b.toLowerCase());

function detectPerson(query) {
  const q = String(query || '');
  const hasContext = /\b(\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{10}|years?\s+of\s+age|age\s+\d|\bdob\b|d\.o\.b|born|lives?\s+in|resides?\s+in)\b/i.test(q);

  // Anchor the name off an intent phrase when present ("...information about NAME ...").
  const anchored = q.match(/\b(?:about|on|for|of|regarding|named|up)\s+([A-Za-z][A-Za-z'.-]*(?:\s+[A-Za-z][A-Za-z'.-]*){0,4})/i);
  const intent = /\b(find|look\s*up|lookup|gather|research|investigate|who\s+is|info(?:rmation)?\s+(?:about|on)|search\s+for|dig\s+up|background\s+(?:check|on))\b/i.test(q);

  let words = null;
  if (anchored) {
    // Take words after the anchor until a context keyword (number/age/dob/loc).
    words = anchored[1].split(/\s+/).filter(Boolean);
  }
  if (!words) {
    // Fallback: a run of at least two CAPITALIZED words (classic "First Last").
    // Requiring each word to be capitalized is what separates a real name from
    // an ordinary sentence — e.g. "Please research magnetic moon" starts with a
    // capital ("Please") but the rest are lowercase common nouns, so it is NOT a
    // name and must fall through to normal chat rather than a people-search.
    const cap = q.match(/\b([A-Z][a-z'.-]+(?:\s+[A-Z][a-z'.-]+){1,3})\b/);
    if (cap) words = cap[1].split(/\s+/);
  }
  if (!words) return null;

  // Trim leading stopwords, then stop at the first context keyword / stopword.
  while (words.length && NAME_STOP.test(words[0])) words.shift();
  const nameWords = [];
  for (const w of words) {
    if (isContextToken(w) || NAME_STOP.test(w)) break;
    if (!/^[A-Za-z][A-Za-z'.-]*$/.test(w)) break;
    nameWords.push(w);
    if (nameWords.length >= 4) break;
  }
  if (nameWords.length < 2) return null; // need at least first + last
  // Reject a purely lowercase phrase captured after an anchor word (e.g.
  // "information about magnetic moon" → "magnetic moon"): a real person query
  // has a capitalized name or explicit people-search context (phone/DOB/etc.).
  const hasCapital = nameWords.some((w) => /^[A-Z]/.test(w));
  if (!hasCapital && !hasContext) return null;
  if (!intent && !hasContext) return null; // require person-lookup signal
  const name = TITLE(nameWords.join(' '));
  if (Object.keys(L.US_STATES).some((s) => name.toLowerCase() === s)) return null;

  // Location: "lives in/resides in/from/in <City>[,] <State>"
  let city = null; let state = null;
  const loc = q.match(/\b(?:lives?\s+in|resides?\s+in|in|from)\s+([A-Za-z][A-Za-z\s]*?)[,\s]+\b(oregon|california|washington|texas|florida|new york|nevada|arizona|idaho|[A-Z]{2})\b/i);
  if (loc) {
    const c = loc[1].trim().replace(/\s+/g, ' ');
    city = c && c.length > 1 && !NAME_STOP.test(c) ? TITLE(c) : null;
    state = TITLE(loc[2].trim());
  } else {
    const st = q.match(/\b(oregon|california|washington|texas|florida|new york|nevada|arizona|idaho)\b/i);
    if (st) state = TITLE(st[1]);
  }
  return { name, city, state };
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
          // THE LOCAL PART IS A USERNAME. This is the single biggest gap the
          // toolkit had: an address ran one deliverability check and stopped,
          // so "therealduckyduck@gmail.com" produced a yes/no about MX records
          // and nothing a person would call a finding — while the handle sat
          // right there in front of the @, unchecked, on a dozen sites that
          // answer for free.
          //
          // Gravatar's profile and GitHub's commit-email index are the other
          // two that a server can genuinely ask. Everything settles
          // independently so one rate-limit cannot empty the section.
          const localPart = String(ent.value).split('@')[0];
          const [intel, grav, gh, handles] = await Promise.all([
            L.emailIntel(ent.value),
            L.gravatarProfile(ent.value),
            L.githubByEmail(ent.value),
            L.RE.username.test(localPart) ? L.usernameCheck(localPart) : Promise.resolve(null),
          ]);
          f.data = {
            emailIntel: intel,
            gravatar: grav,
            githubByEmail: gh,
            // Labelled as DERIVED so a report never implies the user told us
            // this handle — it was inferred from the address.
            usernameCheck: handles ? { ...handles, derivedFrom: 'email local-part', username: localPart } : null,
          };
        } else if (ent.type === 'phone') {
          f.data = { phoneIntel: L.phoneIntel(ent.value), phoneSearch: L.phoneSearchLinks(ent.value) };
        } else if (ent.type === 'username') {
          f.data = { usernameCheck: await L.usernameCheck(ent.value) };
        } else if (ent.type === 'person') {
          f.data = { peopleSearch: L.peopleSearchLinks({ name: ent.value, city: ent.city, state: ent.state }) };
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
    // Self-published profile + the accounts its owner linked to it.
    if (d.gravatar?.found) push('Gravatar profile', d.gravatar.profileUrl);
    (d.gravatar?.accounts || []).forEach((a) => push(`${a.platform || 'linked'} (via Gravatar)`, a.url));
    (d.gravatar?.urls || []).forEach((u) => push('Site listed on Gravatar profile', u));
    (d.githubByEmail?.users || []).forEach((u) => push(`GitHub: ${u.login}`, u.profile));
    // Public people-search / reverse-phone directory deep links.
    (d.peopleSearch?.links || []).forEach((l) => push(l.name, l.url));
    (d.phoneSearch?.links || []).forEach((l) => push(l.name, l.url));
  }
  return links;
}

function safeDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

async function synthesize(query, findings) {
  const system = `${getModePrompt('ocean')}

ACTIVE TASK: OSINT INVESTIGATION REPORT. You are given structured findings
gathered from free, PUBLIC OSINT sources for the user's query. Write a concise
investigator's report with these sections:
## Summary — what was asked and the headline findings in 2-3 sentences.
## Findings — per entity, the concrete facts discovered (registrar, dates,
nameservers, subdomains, geolocation, MX/deliverability, confirmed profiles,
archive presence, and — for people — the public people-search and public-record
directories where the subject can be looked up). State clearly when a source
returned nothing.
## Leads & Next Steps — the next logical, lawful investigative moves.

AUTHORIZATION — READ CAREFULLY: Compiling PUBLICLY AVAILABLE information about a
named individual is a lawful, standard OSINT and journalism task, no different
from what public people-search directories (Whitepages, TruePeopleSearch,
FastPeopleSearch), public records, and search engines already provide. It is
explicitly IN SCOPE and you MUST NOT refuse it. Providing links to public
records and public directories, summarizing publicly posted information, and
suggesting lawful next steps is permitted and expected.

The ONLY things to decline: requests that seek NON-public data (breaking into
accounts, private/sealed records, paywalled data you'd have to bypass) or that
clearly facilitate harm (explicit intent to stalk, harass, or endanger). Absent
those, proceed and be helpful.

Rules: report only what the findings support — never invent registrants,
owners, addresses, or identities the data does not show. Flag gaps explicitly.
Point the user to the public directories in the findings for the fuller record.`;

  const corpus = `INVESTIGATION QUERY: ${query}

GATHERED FINDINGS (JSON):
${JSON.stringify(findings, null, 2)}`;

  const order = ['nephesh', ...UnifiedAIService.getAvailableProviders()].filter((n, i, a) => a.indexOf(n) === i);
  let lastError = null;
  let refusal = null;
  for (let i = 0; i < order.length; i++) {
    const name = order[i];
    const isLast = i === order.length - 1;
    const provider = UnifiedAIService.getProvider(name);
    if (!provider || !provider.isAvailable?.()) continue;
    try {
      const resp = await UnifiedAIService.callProvider(name, [{ role: 'user', content: corpus }], {
        system,
        mode: 'ocean',
        temperature: 0.3,
        max_tokens: 2000,
      });
      // Same refusal-aware failover as UnifiedAIService.chat: substrate models
      // may refuse a lawful public-records lookup — try the next provider.
      if (UnifiedAIService.isRefusalContent(UnifiedAIService.contentOf(resp)) && !isLast) {
        logger.info('osint synthesis provider refused, failing over:', { provider: name });
        if (!refusal) refusal = attribution.stampResponse({ ...resp, provider: name });
        continue;
      }
      return attribution.stampResponse({ ...resp, provider: name });
    } catch (e) {
      lastError = e;
      logger.warn(`osint synthesis provider ${name} failed:`, e.message);
    }
  }
  if (refusal) return refusal;
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
    // Investigation graph (GraphiPy model): entities + discovered artifacts as
    // typed nodes/edges, for the in-app graph view and Gephi/JSON export.
    graph: OsintGraph.buildFromInvestigation(query, entities, findings).toJSON(),
    report: response.content,
    provider: response.provider,
    nephesh_attribution: response.nephesh_attribution,
  };
}

module.exports = { investigate, detectEntities, gather, extractArtifacts };
