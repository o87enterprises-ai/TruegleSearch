# ad-onboard

A checklist CLI for walking through Truegle Search's ad-distributor signups —
EthicalAds, Carbon Ads, Impact.com, CJ Affiliate, Awin, ShareASale, and
Media.net.

## What this does NOT do

It does not create accounts, fill out signup forms, or submit anything on any
network. Every one of these networks requires a human to apply and pass
manual review (some require tax forms, bank/PayPal linking, or a site review),
and several explicitly prohibit automated account creation in their Terms of
Service. Automating past that point risks the account being banned before
it's even approved.

## What it actually does

- `list` — every network under consideration, plus your local progress
- `blocked` — networks you must NOT re-apply to without fixing the underlying
  issue first (Google AdSense, Monetag, Adsterra — see `HANDOFF.md`)
- `info <network>` — the prerequisites checklist, the real application URL,
  and the typical review timeline
- `apply <network>` — prints (and tries to open in your browser) the real
  application URL, then marks it "applied" in a local progress file. You fill
  out and submit the form yourself.
- `creds set <network> KEY=VALUE...` — once a network approves you and gives
  you a publisher ID / API key, store it locally (`~/.truegle-ad-onboarding/state.json`,
  `chmod 600`). Nothing here transmits that value anywhere — it's just a
  local note so you remember what you have before wiring it into `env.js` /
  `houseAds.js`.
- `creds list [network]` — see which keys are stored (masked)
- `status [network]` — your local progress across every network

## Setup

```bash
cd tools/ad-distributor-cli
npm install
node bin/ad-onboard.js list
```

Optionally link it so you can run `ad-onboard` directly:

```bash
npm link
ad-onboard list
```

## Suggested flow per network

```bash
ad-onboard info ethicalads      # read the checklist first
ad-onboard apply ethicalads     # opens the real application page, marks it applied
# ... go fill out and submit the form yourself, wait for manual approval ...
ad-onboard creds set ethicalads PUBLISHER_ID=xxxx PLACEMENT_ID=yyyy
ad-onboard status ethicalads    # confirm what's stored
```

Each network's `info` output also tells you where the credential ultimately
belongs in the codebase (`envTarget`) — usually a new Joi entry + exported
field in `apps/backend/config/env.js`, or a tracked link slotted into
`AFFILIATE_OFFERS` in `apps/frontend/src/config/houseAds.js`. Wiring the
credential into the actual ad-rendering code is a separate, deliberate code
change — this tool only tracks "did I apply" and "what did I get back."

## Why these seven, and not others

This list matches the current candidates being evaluated for Truegle's ad
layer (see `apps/frontend/src/config/houseAds.js` and `HANDOFF.md`). Google
AdSense, Monetag, and Adsterra were tried and removed — `ad-onboard blocked`
explains why for each, sourced from `HANDOFF.md`. Don't reapply to those
without addressing the reason they were removed.
