# Truegle — Production Readiness & Security Action Plan

_Created 2026-08-01. Living doc — check items off as they ship._

## Context

We're closing in on launch. This plan covers (A) what must be true before
Truegle serves real traffic on production, and (B) a security program built for
the specific threat the owner named: **AI-powered attacks**. It is grounded in
the real stack — **Cloudflare Pages** (static frontend) + **Vercel serverless**
(Node/Express backend) + **Neon Postgres**, $0 budget, no self-host box.

---

## ⚖️ Security boundary (read first)

We build **defense, forensics, and authorized offense against our own systems**.
We do **not** build hack-back / counter-intrusion.

- **Legal:** continuously attacking *our own* attack surface (self-pentest),
  blocking attackers at our edge, and logging attacks *against our systems* to
  hand to law enforcement.
- **Not legal (never build):** probing, accessing, deploying code to, or
  "striking back" at an attacker's systems. Under the CFAA (and Computer Misuse
  Act, etc.) that is a felony **even for a victim** — it turns Truegle from the
  wronged party into the defendant and hands a real attacker a lawsuit. It also
  breaks the brand promise (Truegle *is* trust).

Every goal the owner named — stay ahead of new vulns, counter live attacks,
gather prosecutable intel — is fully achievable on the legal side below.

---

## Part A — Production readiness

Priority: **P0 = launch-blocking**, P1 = do soon after, P2 = hardening.

### P0 — must be done before real traffic

| # | Item | Why / where | $ |
|---|------|-------------|---|
| A1 | **Rotate the exposed DB password** | Open thread: the Neon password was pasted in chat. Rotate in Neon, update Vercel `DATABASE_URL`. | $0 |
| A2 | **Full secret rotation + audit** | Rotate every key that ever touched chat/logs; confirm none are committed (see B-RED gitleaks). `.env.example` stays the secret-free manifest. | $0 |
| A3 | **Edge rate limiting is the real throttle** | `middleware/rateLimit.js` uses an **in-memory** store — on Vercel serverless it resets every cold start and isn't shared across instances, so it barely throttles. Put the real limit at **Cloudflare** (WAF rate-limiting rules, free tier). Keep the app limiter as defense-in-depth. | $0 |
| A4 | **Confirm migrations apply on deploy** | `server.js autoMigrate()` runs idempotent `.sql` on boot, but **seeds are manual** (`npm run migrate`). Verify prod schema (incl. new `017`) is applied and `ai_providers` is seeded, or provider ordering silently relies on code defaults. | $0 |
| A5 | **Error tracking on** | `SENTRY_DSN` is wired but optional. Turn it on (Sentry free tier) so prod errors are visible, with PII scrubbing (we already `stripPII`). | $0 |
| A6 | **CSP / headers verified in the browser** | Strict CSP lives in `public/_headers`; any new inline script needs its sha256, any new third-party host needs `connect/script/frame-src`. Verify console is clean post-deploy (ponytail: boot it). | $0 |
| A7 | **Health check + uptime** | `scripts/healthcheck.js` exists — wire an external free monitor (UptimeRobot) on `/health` and the frontend. | $0 |

### P1 — soon after launch

| # | Item | Why |
|---|------|-----|
| A8 | **Sliding 90-day session** | Open thread: extend JWT on each `/validate` so active users don't get logged out. |
| A9 | **Backups / PITR** | Confirm Neon point-in-time restore window; document a restore runbook. |
| A10 | **Load sanity** | Cheap k6/autocannon run against staging to find the serverless cold-start + DB-pool ceiling before users do. |
| A11 | **Legal pages current** | Privacy policy reflects `search_queries` (anon aggregate), `ai_feedback`, and the new `citation_log`; terms + DMCA/abuse contact live. |

### P2 — hardening

| # | Item |
|---|------|
| A12 | Structured logging + log retention policy (already PII-scrubbed). |
| A13 | Dependency pinning + `package-lock` in sync (CF `npm ci` fails silently on desync). |
| A14 | Staging/preview parity with prod (Neon dev branch). |

---

## Part B — Security program: "Autonomous Offense & Defense" (lawful)

Three engines, same $0 GitHub-Actions pattern as the citation engine (scheduler
+ compute, no new infra). Ship **Phase 0 first** — it's the highest ROI and all
free.

### B-RED — Autonomous offense **against our own attack surface** (self-pentest)

This is the legal, powerful version of "autonomous offense": we continuously
attack *ourselves* and fix what we find before an attacker does.

| Phase | What | Tooling (free/OSS) |
|---|---|---|
| 0 | **CVE + dependency scanning on every PR & nightly** | Dependabot, `npm audit` / `osv-scanner`, Trivy |
| 0 | **SAST on every PR** | Semgrep (free rules) + the existing **`/security-review`** skill on the branch diff |
| 0 | **Secret scanning** | gitleaks / GitHub secret scanning (catches A2 regressions) |
| 1 | **Nightly DAST against staging** | OWASP ZAP baseline + Nuclei (CVE/misconfig templates) hitting a preview URL, results → an issue |
| 2 | **Fuzzing the AI + OSINT inputs** | scripted prompt-injection/jailbreak test suite run on a schedule (regression net for B-BLUE) |

### B-BLUE — Autonomous defense (counter live attacks)

| Phase | What | How |
|---|---|---|
| 0 | **Cloudflare WAF managed rules + Bot Fight Mode** | Free tier; blocks the bulk of automated attacks at the edge before they reach Vercel |
| 0 | **Tighten existing middleware** | `botDetection.js` / `security.js` already exist — keep the legal-only content policy, harden headers |
| 1 | **AI-surface injection guard** (the "AI-powered hacking" defense) | The open-thread **anti-injection sub-agent**: screen chat/OSINT inputs for prompt-injection / jailbreak / abuse *before* they hit the model; filter outputs. Directly answers the owner's concern. |
| 1 | **Adaptive auto-ban** | On detected abuse/injection, call the Cloudflare API to block the IP/ASN for a TTL — **after** the evidence is logged (B-FORENSICS). Normal users are untouched. |
| 2 | **Threat-intel ingestion** | Free feeds (abuse.ch, Spamhaus DROP, Tor exit list, CVE feeds) auto-pulled to pre-block known-bad + prioritize patching. |

### B-FORENSICS — Prosecutable intel (lawful, on our own systems)

The owner's real goal — "gain information on attacking parties for prosecution" —
done the way that gets attackers convicted instead of us.

- **Capture (lawful):** an append-only attack log of request metadata,
  fingerprint, timestamps, and the matched rule — **for detected malicious
  actors**, fuller than normal-user anonymization (legitimate-interest security
  monitoring on our own property; normal users stay anonymized under
  `privacy.js`). Document the legal basis in the privacy policy.
- **Preserve:** append-only store + export; simple chain-of-custody notes.
- **Report:** an incident-response runbook + an abuse-report generator that
  packages the evidence for **FBI IC3, the hosting provider's `abuse@`, and the
  national CERT**. Hand off — never pursue.
- **Boundary:** no counter-intrusion, no deanonymizing via offensive means. (See
  top of doc.)

---

## Sequencing

1. **Part A P0** (launch blockers) — DB rotation, edge rate limiting, migrations,
   error tracking, CSP verify.
2. **B Phase 0** (all $0, one GitHub Actions workflow) — dependency/CVE/SAST/
   secret scanning + Cloudflare WAF on.
3. **B Phase 1** — injection guard (AI-surface defense) + adaptive edge auto-ban
   + forensic capture + nightly DAST.
4. **Part A P1/P2** + **B Phase 2** — threat intel, fuzzing, load, backups.

Everything here is $0 (free tiers + OSS + the existing GitHub Actions pattern).
Any item that would cost money is flagged before we incur it.
