# Deploying Nephesh 1.3 on the EC2 Host — Step-by-Step

Goal: the AWS box (the one already running SearXNG/Revive, Elastic IP
`44.236.219.63`) serves Nephesh 1.3 behind an authenticated proxy, and the
Vercel backend starts routing all AI responses through it.

Every step ends with a check. If a check fails, stop and fix before moving on.

---

## Step 1 — SSH in and size the box

```bash
ssh ec2-user@44.236.219.63          # or your usual SSH alias/key
free -h && df -h / && nproc
```

**Check:** note the `available` memory column. Pick your base model:

| Available RAM | Base to use | Command suffix |
|---|---|---|
| ≥ 7 GB | `qwen3:8b` (default — best audit quality) | *(no argument)* |
| 4–7 GB | `phi4-mini-reasoning` | `phi4-mini-reasoning` |
| 2–4 GB | `llama3.2` | `llama3.2` |
| < 2 GB | Stop — the box can't serve Nephesh; plan a host change first ($0-budget rule: get approval) |

Also confirm ≥ 10 GB free disk for the model download.

## Step 2 — Get the nephesh/ directory onto the host

```bash
git clone --depth 1 https://github.com/o87enterprises-ai/TruegleSearch.git
cd TruegleSearch/nephesh/scripts
chmod +x install-nephesh.sh create-nephesh.sh
```

**Check:** `ls` shows both scripts plus `../Modelfile`.

## Step 3 — Install Ollama and pull the base

```bash
./install-nephesh.sh                # or: ./install-nephesh.sh llama3.2
```

**Check:** ends with `Done.` and `curl -s http://localhost:11434/api/tags`
returns JSON.

## Step 4 — Build nephesh:1.3

```bash
./create-nephesh.sh                 # or: ./create-nephesh.sh llama3.2
```

**Check:** `ollama list` shows `nephesh:1.3`. Smoke-test the Null-Prime engine:

```bash
ollama run nephesh:1.3 "Dark matter exists. Audit both sides."
```

You should see DECOMPOSE → DUAL AUDIT → DUAL IRE → VERDICT with borrowed-axiom
lists on both sides, no numerical probability, and the attribution block.
Note the response time — that's your latency baseline.

## Step 5 — Generate the shared-secret token

```bash
openssl rand -hex 32
```

**Check:** copy the 64-char string somewhere safe. This is `NEPHESH_AUTH_TOKEN`.
It will exist in exactly two places: the nginx config (below) and Vercel env.

## Step 6 — Put nginx in front (Ollama has NO auth of its own)

```bash
sudo tee /etc/nginx/conf.d/nephesh.conf > /dev/null <<'EOF'
# Nephesh 1.3 — bearer-token proxy to local Ollama
server {
    listen 80;
    server_name ai.truegle.info;

    location /nephesh/ {
        if ($http_authorization != "Bearer PASTE_TOKEN_HERE") { return 401; }
        proxy_pass http://127.0.0.1:11434/;
        proxy_read_timeout 300s;       # CPU inference is slow; don't cut it off
        proxy_http_version 1.1;
        client_max_body_size 2m;
    }
}
EOF
sudo sed -i "s|PASTE_TOKEN_HERE|<your token from step 5>|" /etc/nginx/conf.d/nephesh.conf
sudo nginx -t && sudo systemctl reload nginx
```

**Check (both must pass):**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/nephesh/api/tags -H "Host: ai.truegle.info"                                   # → 401
curl -s http://localhost/nephesh/api/tags -H "Host: ai.truegle.info" -H "Authorization: Bearer <token>" | head -c 80                    # → JSON
```

## Step 7 — EC2 security group (AWS console)

EC2 → Instances → your instance → Security tab → security group → Edit inbound rules:
- Ensure port **80** is open (it already is if `ads.truegle.info` works).
- Ensure port **11434 is NOT in the list.** If it is, delete that rule — Ollama must never be reachable directly.

**Check:** from your laptop/phone (not the EC2 box): `curl --max-time 5 http://44.236.219.63:11434/api/tags` must FAIL (timeout/refused).

## Step 8 — Cloudflare DNS (dashboard)

Cloudflare → truegle.info → DNS → Add record:
- Type `A`, Name `ai`, IPv4 `44.236.219.63`, Proxy status **ON (orange cloud)**.

Same pattern as `ads.truegle.info`: Cloudflare terminates HTTPS at the edge and
speaks HTTP to the origin. If HTTPS to the origin errors with 522/525, add the
same SSL "Flexible" configuration rule you already use for `ads.truegle.info`,
scoped to `ai.truegle.info/*`.

**Check:** from anywhere:
```bash
curl -s https://ai.truegle.info/nephesh/api/tags -H "Authorization: Bearer <token>" | head -c 80    # → JSON
```

## Step 9 — Run the promotion gate before flipping traffic

From your dev machine (or the EC2 box itself), in the repo:

```bash
NEPHESH_BASE_URL=https://ai.truegle.info/nephesh NEPHESH_AUTH_TOKEN=<token> node nephesh/eval/run-eval.mjs
```

**Check:** aim for all items passing. On a CPU host the p95 < 3s target will
likely warn — that's expected and acceptable for launch; note the actual p95.
Then run the manual symmetry battery (`nephesh/eval/bias-battery.md`) on the
matched pairs and record the treatment gap.

## Step 10 — Point the backend at it (Vercel dashboard)

Vercel → backend project → Settings → Environment Variables → add (Production):

| Name | Value |
|---|---|
| `NEPHESH_BASE_URL` | `https://ai.truegle.info/nephesh` |
| `NEPHESH_MODEL` | `nephesh:1.3` |
| `NEPHESH_AUTH_TOKEN` | the token from step 5 |

Then Deployments → ⋯ on the latest → **Redeploy**.

**Check:** after redeploy:
```bash
curl -s -X POST https://backend-seven-khaki-60.vercel.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is a filter bubble?","context":"search_results"}'
```
The response JSON should show `"provider":"nephesh"`, `"servedBy":"Nephesh · via Truegle"`,
and the content ends with the attribution block. If Nephesh is down the backend
silently falls back to the interim providers — that's by design.

## Step 11 — Record it (session hygiene)

- `HANDOFF.md`: served version (`nephesh:1.3` + base used), endpoint hostname, eval results, measured p95.
- `docs/SECRETS-MAP.md`: add `NEPHESH_AUTH_TOKEN` (name + where it lives: nginx conf on EC2, Vercel env — never the value).

## Rollback

Remove the three env vars from Vercel and redeploy — the backend instantly
reverts to the interim provider mix. The EC2 pieces can stay in place.

## Watch out for

- **Vercel serverless timeout**: Pro plan functions cap at 60s by default (Hobby 10s). A slow CPU generation can exceed it — if you see function timeouts, use the smaller base (`llama3.2`) or raise `maxDuration` in `vercel.json` for the AI routes.
- **qwen3 thinking tokens**: qwen3 models emit internal reasoning that slows first-token time on CPU. If latency is unacceptable at 8B, `phi4-mini-reasoning` is the intended fallback (per Null-Prime v3.1).
- **RAM pressure**: SearXNG + Revive + MariaDB already live on this box. If the model OOMs, drop a base size rather than adding swap — swap-backed inference is unusably slow.
