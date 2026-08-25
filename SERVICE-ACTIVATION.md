# Truegle — Service Activation Guide (phone-friendly)

Do these **one at a time**, in this order. Each block is self-contained. Most are
dashboard clicks doable from your phone on cellular. The only step that needs a
computer + internet is **Deploy** (Step 8) — everything else just activates the service.

## Reference values (copy as needed)
- Current live frontend: **trumpafi.online** (Cloudflare Pages project `truegle-search`)
- New primary domain: **truegle.info** (bought at IONOS)
- Backend API: **https://backend-seven-khaki-60.vercel.app** (Vercel project `backend`)
- Accounts: Cloudflare/Wrangler = **o87enterprises@gmail.com** · Vercel = **o87enterprises** · GitHub = **o87enterprises-ai**
- Google CSE ID: `54cdc3626cf504531`
- Google OAuth Client ID: `1004953436750-0a1ni3p4mqaihh3593gvibq7tqsc5gma.apps.googleusercontent.com`
- OAuth callback: `https://backend-seven-khaki-60.vercel.app/api/auth/google/callback`
- AdSense publisher: `pub-9542137900411519`

> **Current deploy is SAFE for testers.** Social sign-in (Google/Apple) is hidden by
> default (a feature flag) until OAuth is published — email/password works. Unactivated
> services degrade gracefully (search falls back to Brave; ads show blank; SearXNG is skipped).

---

## Step 1 — DNS: move `truegle.info` to Cloudflare  ⛳ gates the new domain only
> The desktop Cloudflare dashboard wouldn't load on your home network. **Try it on the
> phone (cellular)** — it's often a local-network/DNS issue, not Cloudflare.

1. **dash.cloudflare.com** → confirm you're in **O87enterprises@gmail.com's Account**.
2. **+ Add a domain** → `truegle.info` → **Free** plan → Continue through the DNS scan.
3. Copy the **2 nameservers** Cloudflare shows (e.g. `x.ns.cloudflare.com` / `y.ns.cloudflare.com`).
4. **IONOS** → log in → Domains → `truegle.info` → **Nameserver settings** → switch from IONOS
   nameservers to **"use custom/external nameservers"** → paste Cloudflare's 2 nameservers → Save.
5. Back in **Cloudflare Pages → `truegle-search` → Custom domains** → **Set up a domain** →
   add `truegle.info`, then again for `www.truegle.info`.
6. (Optional, do after truegle.info works) `trumpafi.online` → add a redirect rule → 301 → `https://truegle.info`.

**Verify:** after a while, `truegle.info` loads the site. DNS can take 30 min – a few hours.
**If Cloudflare still won't load:** skip this; testers keep using trumpafi.online. Come back to it.

---

## Step 2 — Google Custom Search API  ✅ no redeploy
Fixes the `403 PERMISSION_DENIED` so Google results supplement Brave.
1. **console.cloud.google.com** → select the project that owns `GOOGLE_API_KEY`.
2. **APIs & Services → Library** → search **"Custom Search API"** → **Enable**.
3. (Optional) Programmable Search Engine (`programmablesearchengine.google.com`) → engine
   `54cdc3626cf504531` → turn on **"Search the entire web"** / add ~50 broad domains.

**Verify:** `https://backend-seven-khaki-60.vercel.app/api/search/health` → Google shows healthy.

---

## Step 3 — Google OAuth (publish consent)  ⚠️ needs redeploy to show buttons
1. **console.cloud.google.com → APIs & Services → OAuth consent screen**.
2. If in **Testing**: either **Publish app** (→ In production), or add your tester emails under
   **Test users**.
3. **Credentials → your OAuth 2.0 Client** → confirm:
   - **Authorized redirect URI:** `https://backend-seven-khaki-60.vercel.app/api/auth/google/callback`
   - **Authorized JavaScript origins:** add `https://trumpafi.online` and (later) `https://truegle.info`.
4. To make the **Google sign-in button appear**, set frontend env **`VITE_SOCIAL_AUTH_ENABLED=true`**
   then redeploy the frontend (Step 8). Until then it stays hidden (by design).

**Verify (after Step 8):** Sign-in page shows Google button → click → Google → back signed in.

---

## Step 4 — Email (Resend domain verify)  🔗 needs DNS (Step 1) first
Only needed for outbound email (password reset / contact). **Signup does NOT require email**, so
this is not blocking testers.
1. **resend.com → Domains → Add Domain** → enter your sending domain (e.g. `truegle.info`).
2. Resend shows **DNS records** (SPF/DKIM/MX-ish, a few TXT/CNAME).
3. Add those records in **Cloudflare → truegle.info → DNS** (once Step 1 is done).
4. Back in Resend → **Verify**.

**Verify:** Resend domain shows "Verified". Confirm `RESEND_API_KEY` is set on Vercel (it is).

### Those daily "Report domain: truegle.info" emails are NOT a problem

If `truegleai@proton.me` starts receiving mail from `noreply-dmarc-support@google.com`
with a subject like **"Report domain: truegle.info Submitter: google.com Report-ID: …"**
and a small `.gz` attachment named `google.com!truegle.info!<start>!<end>.xml.gz` —
that is normal, expected, and a sign the DNS is set up **correctly**.

They are **DMARC aggregate reports**. A `_dmarc.truegle.info` TXT record is published
containing `rua=mailto:…`, and that record is a standing request to every mailbox
provider on the internet: *"send me a daily report of mail claiming to be from my
domain."* Google is obeying it. Microsoft and Yahoo will do the same. The message body
is empty because the entire report is the attachment.

**Nothing is being attacked, and nothing needs doing.** DMARC protects the domain from
the DNS record alone — reading the reports is entirely optional and changes nothing
about enforcement.

Three ways to handle them; pick one and stop thinking about it:

| Option | What happens | Trade-off |
|---|---|---|
| **Filter or delete them** | Reports keep arriving, you ignore them | You never learn if someone spoofs the domain |
| **Drop `rua=` from the DNS record** | Mail stops entirely | Same as above, but no inbox clutter |
| **Point `rua=` at a free digest service** | Plain-English weekly summary instead of XML | A third party receives the reports |

For the third option, Postmark's DMARC digests (`dmarc.postmarkapp.com`) are free and
send readable summaries. Weigh it against the no-third-parties stance in
`docs/AD-POLICY.md` and the general privacy posture: the reports contain sending IPs
and volumes for our domain — no user data — but it is still handing our mail telemetry
to somebody else.

**If you ever DO want to know whether the domain is being spoofed**, that answer only
exists inside the report XML. Each `<record>` block carries a sending IP, a message
count and `dkim`/`spf` pass-fail results. What matters:
- **Fails from IPs we recognise** (Resend, Vercel) → our own mail is not authenticating,
  so password-reset mail will be landing in spam. Worth fixing.
- **Fails from IPs we do not recognise** → somebody is sending mail as `truegle.info`.
  This is the case DMARC exists to catch.
- **Everything passing** → pure background noise.

Checking the DNS record itself needs no attachment opening at all — `mxtoolbox.com/dmarc.aspx`
with `truegle.info` shows the published policy in a browser. Note that shows the POLICY,
not the reports, so it confirms the setup is right but says nothing about spoofing.

---

## Step 5 — AdSense review  🚧 needs legal pages first
1. **PREREQUISITE:** the site needs **Privacy Policy / Terms / About** pages. These don't exist yet
   — ask Claude to add `/privacy`, `/terms`, `/about` routes (quick, ~1 session), then redeploy.
2. **adsense.google.com** → your site → ensure `ads.txt` is detected (it's already live + valid,
   publisher `pub-9542137900411519`).
3. Submit the site for **review** once the domain is final (ideally `truegle.info`) and legal pages exist.

**Verify:** AdSense status → "Ready"/"Approved" (review can take days).

---

## Step 6 — Search Console + Bing  🔗 easier after DNS (Step 1)
1. **search.google.com/search-console** → Add property → `https://truegle.info` (or trumpafi.online).
2. Verify via **DNS TXT** (add the TXT in Cloudflare DNS) — easiest once Step 1 is done.
3. **Submit sitemap:** `https://<domain>/sitemap.xml`.
4. URL Inspection → Request indexing for `/` and `/search`.
5. **bing.com/webmasters** → Add site → **Import from Google Search Console** (one click).

---

## Step 7 — (Optional, later) SearXNG + Stripe live
- **SearXNG:** once you host SearXNG on a persistent box (your iMac, a VPS), set on Vercel backend:
  `SEARXNG_URL=https://<your-host>` and `SEARXNG_PRIMARY=true` (optional `SEARXNG_PRIMARY_MIN=5`).
  Then SearXNG becomes the primary provider with the APIs as fallback. Redeploy backend.
- **Stripe:** keep **test** keys for testers. Only swap `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY`
  to **live** keys when charging real users; complete Stripe account verification first.

---

## Step 8 — Deploy (needs a computer + internet)
Run from the repo root after the above. Env changes alone (Vercel dashboard) don't need this;
**frontend code/flag changes do.**

**Set backend env (Vercel dashboard → project `backend` → Settings → Environment Variables):**
- `FRONTEND_URL=https://truegle.info`  (only after Step 1 resolves; else leave as trumpafi.online)
- `SEARXNG_PRIMARY=true` (only after Step 7)

**Set frontend env (for the build):** create `apps/frontend/.env.production` with:
```
VITE_BACKEND_URL=https://backend-seven-khaki-60.vercel.app
VITE_SOCIAL_AUTH_ENABLED=true   # only after Step 3 (OAuth published)
VITE_MAPBOX_TOKEN=<your token>
```

**Deploy backend (Vercel):**
```
cd apps/backend && vercel deploy --prod --yes
```

**Deploy frontend (Cloudflare Pages):**
```
cd apps/frontend && NODE_OPTIONS=--max-old-space-size=4096 node ../../node_modules/vite/dist/node/cli.js build
wrangler pages deploy dist --project-name=truegle-search --branch=main
```

**Verify live:** `/` loads · search returns results · `/ads.txt`, `/sitemap.xml`, `/robots.txt` reachable
· sign-in works · (if enabled) Google button appears.

---

## Env-var cheat sheet (what flips what)
| Variable | Where | Set when | Effect |
|---|---|---|---|
| `VITE_SOCIAL_AUTH_ENABLED=true` | frontend build | after OAuth published (Step 3) | shows Google/Apple sign-in buttons |
| `FRONTEND_URL=https://truegle.info` | Vercel backend | after DNS (Step 1) | OAuth redirects + sitemap base |
| `SEARXNG_PRIMARY=true` | Vercel backend | after SearXNG host (Step 7) | SearXNG becomes primary search |
| `SEARXNG_PRIMARY_MIN` | Vercel backend | optional | min SearXNG results before API fallback (default 5) |

## Notes
- Live OSINT = **Ocean mode** (`/search?mode=ocean`); the 4 free tools (IP/DNS/WHOIS/Username) work
  with no keys. Email-finder + Shodan tools are not wired yet (need Hunter.io/Shodan + token).
- `OSINTMode.jsx` is dead/unrouted — safe to delete.
