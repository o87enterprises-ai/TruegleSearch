# Putting SearXNG behind Cloudflare (and closing port 8080)

**Why:** `http://44.236.219.63:8080` exposed SearXNG — an unauthenticated
metasearch proxy — to the whole internet. Anyone could drive queries through it
under our datacenter Elastic IP, which is exactly what pushes upstream engines
to CAPTCHA/403 us. This retires that raw port the same way Morty (`anon.`) and
Revive (`ads.`) are already fronted by Cloudflare.

**End state:** backend calls `https://search.truegle.info` → Cloudflare (TLS +
WAF) → nginx :80 → SearXNG `127.0.0.1:8888`; security-group port **8080 closed**.

The order matters — every step is additive and reversible, and search never goes
down because 8080 keeps working until the very last step.

## 1. Cloudflare DNS  *(you — dash.cloudflare.com)*
Add an A record on the `truegle.info` zone:
- **Name:** `search`
- **IPv4:** `44.236.219.63`
- **Proxy status:** Proxied (orange cloud) — this is what gives us TLS + WAF.

SSL/TLS mode must be **Flexible** (same as the working `ads.`/`anon.` records).

## 2. nginx vhost  *(you — on the EC2 box via EC2 Instance Connect)*
The config is in the repo at `scripts/searxng-nginx.conf`. On the box:
```
sudo tee /etc/nginx/conf.d/searxng.conf < searxng-nginx.conf   # or paste it
sudo nginx -t && sudo systemctl reload nginx
```
(This adds a `search.truegle.info` server block on port 80 — it does not touch
the existing 8080 listener.)

## 3. Verify the new path works  *(either of us)*
```
curl -s "https://search.truegle.info/search?q=test&format=json" | head -c 200
```
Expect JSON with results. If Cloudflare 5xx/handshake, check the SSL mode is
Flexible and the DNS record is Proxied.

## 4. Repoint the backend  *(you or me — Vercel project "backend")*
```
SEARXNG_URL = https://search.truegle.info      # was http://44.236.219.63:8080
```
Then redeploy the backend and confirm a live query returns `source:"searxng"`.

## 5. Close port 8080  *(me — AWS CLI)*
Only after step 4 verifies:
```
aws ec2 revoke-security-group-ingress --group-id sg-063b58a4ed8289b4e \
  --protocol tcp --port 8080 --cidr 0.0.0.0/0 --region us-west-2
```

## Rollback
Set `SEARXNG_URL` back to `http://44.236.219.63:8080` and re-add the SG rule
(`authorize-security-group-ingress`, same args as the revoke). 8080 stays live
and untouched until step 5, so rollback before then is just the env var.
