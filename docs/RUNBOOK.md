# Runbook — the things Claude cannot do from its sandbox

Everything in here needs a browser you are signed into, or a machine Claude
cannot reach. The agent's sandbox has **no outbound access to `truegle.info`,
`api.truegle.info`, `vercel.com`, or the EC2 box** — its proxy 403s all of them —
so these are yours to run, and it is worth knowing which is which before losing
an afternoon to "why can't it just check".

---

## 1. Search returns no WEB results (SearXNG is down)

**The symptom, and how to be sure it is this one.** Results come back — a
hundred of them — but every single card is a video or news provider
(dailymotion, bing videos, News API) and there are no ordinary web pages.
SearXNG is primary for web search, so when it is down the web tier vanishes
while everything else carries on. A count like "About 102 results" with nothing
but videos in it *is* this fault, not a relevance problem.

This has now happened three times. The causes so far, in order of likelihood:

1. **The container stopped or is crash-looping.** Usually a `settings.yml` it
   cannot parse — the file is only re-read on restart, so a bad edit can sit
   harmlessly for weeks and then take the box down at the next reboot.
2. **The instance failed its reachability check.** Cleared by a reboot.
3. **Out of memory.** t3.micro is 1 GB. There should be a 1 GB swapfile.

### Getting on the box

The SSH key is lost and cannot be recovered. Use **EC2 Instance Connect**
(browser): AWS console → EC2 → Instances → `i-0709a9d47e503384f` → *Connect* →
*EC2 Instance Connect*. Region is **us-west-2 (Oregon)**, Elastic IP
`44.236.219.63`.

Know which shell you are looking at — this has cost time before:

| prompt | where you are |
|---|---|
| `~ $` | CloudShell — **not** the box. Commands here will not find the container. |
| `[ec2-user@ip-172-31-… ~]$` | the box |
| `[root@ip-172-31-… …]#` | the box, as root |

### Diagnose

```sh
sudo docker ps -a | grep -i searx      # Up? Restarting? Exited?
sudo docker logs --tail 40 $(sudo docker ps -aq --filter name=searxng)
free -m                                # swap present? memory exhausted?
curl -s 'http://localhost:8888/search?q=test&format=json' | head -c 300
```

That last line is the real test. If it returns JSON with results, SearXNG is
fine and the fault is between it and the backend.

### Fix, by what the logs said

**`SearxSettingsException` / a YAML parse error** — something in `settings.yml`
is malformed. The known one is `result_proxy.key`, whose base64 must be a single
unbroken line; an editor wrapped it once and that took the site down.

```sh
sudo docker restart $(sudo docker ps -aq --filter name=searxng)
```

To edit the file, note it lives inside a Docker volume that only root can list,
so a glob will not expand as `ec2-user`:

```sh
sudo sh -c 'ls /var/lib/docker/volumes/*/_data/settings.yml'
```

Edit with `sed -i` rather than vi. A half-finished vi session leaves a swap file
that blocks the next edit, which is its own detour.

**Container missing entirely, or `Exited`**

```sh
sudo docker start $(sudo docker ps -aq --filter name=searxng) \
  || sudo docker ps -a          # nothing to start? it needs recreating
```

**Out of memory / no swap**

```sh
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile \
  && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # survives reboot
```

**Nothing responds at all** — reboot the instance from the console and wait for
3/3 status checks, then re-run the diagnosis.

### Verify from outside

```powershell
curl.exe -X POST https://api.truegle.info/api/search `
  -H "Content-Type: application/json" `
  -H "X-Truegle-Client: manual-test" `
  -d "{\"query\":\"test\"}"
```

Web results present = fixed. Videos only = still down.

> The `X-Truegle-Client` header is required. Without it the API answers 403:
> anonymous automation is refused, and `curl` is on that list. See
> `truegle.info/developers`.

---

## 2. Deploying

**They are two separate deploys and they are not interchangeable.** Backend
changes need the backend; UI changes need the frontend. Checking a backend fix
after redeploying only the frontend is a real way to lose half an hour.

| what changed | redeploy |
|---|---|
| `apps/backend/**` — ranking, API, AI, feeds | **Vercel**, project `backend` |
| `apps/frontend/**` — player, search page, chat | **Cloudflare Pages** |

Both build from `main`, so `git push origin HEAD:main` is what queues them.

---

## 3. Reading backend logs

Retention on Hobby is roughly a day, so reproduce-and-watch beats digging.

```powershell
npx vercel logs --project backend --environment production --level error --since 24h -x -n 200
npx vercel logs --project backend --follow --level error     # watch it happen live
```

`-x` expands the full message under each request line, which is where the real
provider error sits. For an AI failure specifically, `routes/ai.js` logs
`AI chat error:` with the underlying message.

---

## 4. The Reddit app

App identifier is **`truegleredd`** (`truegle-search` was taken). Playtest
community: `r/truegleredd_dev`.

```sh
cd apps/reddit
npm install
npm run login          # Reddit developer account
npm run dev            # playtest — ALSO submits the fetch-domain request
npm run launch         # submit for review (~1 week)
```

`npm run dev` is what puts `api.truegle.info` in front of Reddit's review, so the
domain must resolve before you run it. Approved domains appear at
<https://developers.reddit.com/apps/truegleredd/developer-settings>.

Do **not** run `devvit init --force` — it scaffolds a fresh template over the
project.

---

## 5. Things Claude genuinely cannot check

Worth stating so neither of us pretends otherwise:

- **anything served from `truegle.info` or `api.truegle.info`** — proxy 403
- **the EC2 box** — no route, no key
- **Vercel and Cloudflare dashboards or logs** — no session
- **a real phone** — so touch gestures, device motion and the on-screen keyboard
  are reasoned about and unit-tested, never observed
- **third-party embeds behaving** — TikTok's audio on fullscreen is the current
  example: our postMessage channel covers YouTube, Vimeo and SoundCloud, and
  TikTok gives us none, so that one needs your eyes on a real device
