# DNS verification request — hand this to the agent that set up the client's DNS

**This is a verification request, not an accusation.** Nothing is known to be wrong.
One unexplained fact turned up, the cheapest way to rule out a cause is to check, and
you are the only party who can see the zone in question. It should take a few minutes.

---

## The one question

> **Did any DNS record you created land on a zone other than the client zone you were
> working on — specifically on `truegle.info`?**

A yes/no with evidence is the whole deliverable.

---

## Why you are being asked

`truegle.info` began receiving daily DMARC aggregate reports from
`noreply-dmarc-support@google.com`. Those only arrive when a `_dmarc.<domain>` TXT
record exists carrying a `rua=mailto:…` tag, so such a record demonstrably exists on
`truegle.info` and points at an inbox the owner reads.

**The owner does not recall ever setting up email for `truegle.info`.** They did set up
DNS and email for a client on the same Cloudflare account, around the same period — which
is you.

The Truegle repo has been checked and cleared:

- No Cloudflare API token was ever persisted in that project (memory, HANDOFF, `.claude/env`, Vercel).
- Its Cloudflare MCP exposes Workers/KV/R2/D1/Hyperdrive + docs — **no DNS or Zone tools**.
- Its open `resend-domain-verify` task writes DNS edits up as manual work for the owner,
  which is not how it would read if a session there could edit a zone.
- No zone files and no DNS-touching commits in its history.

So it was not done from there. That leaves your session as the one place with both the
access and the timing, hence this request. It may well come back clean — a registrar
default or a hand-added record while following an email-setup checklist would explain it
just as well.

---

## ⚠️ Read before you touch anything

**Do not create, modify or delete any record on `truegle.info`.** You do not own that
zone in this task and a "helpful" cleanup on a live domain is far more damaging than the
thing being investigated. Even if you find an obviously misplaced record: **report it,
leave it in place, and let the owner decide.**

Read-only for the whole of this exercise.

---

## How to check

### 1. Public DNS — no credentials needed

```bash
# What is actually published on truegle.info right now
dig +short TXT _dmarc.truegle.info
dig +short TXT truegle.info          # SPF lives here
dig +short MX  truegle.info
dig +short TXT '*._domainkey.truegle.info'

# And the same four for the zone you were meant to be working on
dig +short TXT _dmarc.<CLIENT_DOMAIN>
dig +short TXT <CLIENT_DOMAIN>
dig +short MX  <CLIENT_DOMAIN>
```

No `dig`? Use `https://dns.google/resolve?name=_dmarc.truegle.info&type=TXT`, or
`mxtoolbox.com/dmarc.aspx` in a browser.

### 2. Cloudflare audit log — this is the one that actually answers it

The audit log records every zone change with a timestamp and an actor, which is the
difference between "a record exists" and "you created it".

Dashboard: **Manage Account → Audit Log**, filter to the period you did the client work,
and look for **any action whose resource is the `truegle.info` zone**.

Or via API, with a token that has `Account → Audit Logs → Read`:

```bash
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/audit_logs?per_page=100&since=<YYYY-MM-DD>" \
  | python3 -c "
import sys, json
for e in json.load(sys.stdin).get('result', []):
    owner = (e.get('owner') or {}).get('email', '?')
    res   = (e.get('resource') or {}).get('type', '?')
    meta  = json.dumps(e.get('metadata') or {})[:160]
    if 'truegle' in meta.lower() or 'truegle' in res.lower():
        print(e.get('when'), '|', owner, '|', e.get('action', {}).get('type'), '|', res, '|', meta)
"
```

Silence from that filter is a clean result and is worth reporting as such.

### 3. Compare the zone list

If the client's records were duplicated onto the wrong zone, the two zones will share
values that have no business matching.

```bash
# List every DNS record on truegle.info (needs Zone → DNS → Read)
curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/$TRUEGLE_ZONE_ID/dns_records?per_page=200" \
  | python3 -c "
import sys, json
for r in json.load(sys.stdin).get('result', []):
    print(f\"{r['type']:6} {r['name']:45} {r['content'][:110]}\")
"
```

---

## How to read what you get back

`truegle.info` is a **search engine on Cloudflare Pages with a Vercel backend**. Its
legitimate records are web records:

| Expected on `truegle.info` | Why |
|---|---|
| `A` / `CNAME` on apex and `www` | Cloudflare Pages hosting |
| `CNAME` on `api.` | Vercel backend |
| `TXT` verification strings | Search Console / Cloudflare |

**Mail records are the tell.** The Resend domain verification for `truegle.info` was
never completed — it is still an open task in that project. So the domain should have
**no working outbound-mail setup at all**. Treat each of these as worth reporting:

- 🚩 **`MX` records** — nothing should be receiving mail for this domain.
- 🚩 **DKIM (`*._domainkey`)** with a selector belonging to a provider the client uses.
- 🚩 **SPF (`v=spf1 …`)** with an `include:` for a mail provider Truegle does not use.
- 🚩 **Any record whose content matches the client zone** — the strongest signal there is.
- 🟡 **`_dmarc` with `rua=`** — this is the record that started the investigation. On its
  own it is weak evidence: a DMARC record is commonly added by registrars, by Cloudflare
  onboarding, or by hand from an email checklist. It only becomes meaningful if its
  `rua`/`ruf` address, or its timing in the audit log, ties it to your work.

**Also check the mirror image**, because it is the failure that would actually be hurting
someone: if records intended for the client landed on `truegle.info`, the client's zone
may be **missing** them. That would show up as their mail failing authentication or not
being delivered — which is the thing worth catching today, ahead of a stray record on a
domain that sends no mail.

---

## What to send back

Five lines is plenty:

1. **Verdict** — did anything you created land on `truegle.info`? Yes / No / Cannot tell, and why.
2. **Audit log** — any entries against the `truegle.info` zone in your working window? Paste them, or state that the filter returned nothing.
3. **The `_dmarc.truegle.info` record** — its full value, and whether the `rua` address is one you configured.
4. **Client zone health** — is it complete, or is anything missing that you believe you added?
5. **Anything left in place** for the owner to decide on.

Do not include client credentials, API tokens, or zone IDs in the reply. Record values
and timestamps are enough, and the domain name alone is fine.

---

## If it comes back clean

That is a useful result, not a wasted exercise — it retires the most plausible
explanation. The remaining candidates are a registrar or Cloudflare onboarding default,
or a DMARC record added by hand while following an email-setup checklist (Resend
recommends publishing one, and Truegle's own `SERVICE-ACTIVATION.md` Step 4 walks
through adding Resend's DNS records).

Either way `truegle.info` is not at risk from the reports themselves. DMARC enforces from
the DNS record alone; the reports are informational, and receiving them means the policy
is published and working.
