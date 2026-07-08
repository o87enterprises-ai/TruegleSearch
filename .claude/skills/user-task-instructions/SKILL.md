---
name: user-task-instructions
description: Produce step-by-step visual instructions for tasks the user must do manually (dashboard toggles, DNS records, ad-zone creation). Drives a headless browser to visit URLs/forums, navigate dashboards and tabs, screenshot each step, and assemble an illustrated walkthrough.
---

# User Task Instructions — Visual Walkthrough Builder

Many Truegle tasks can only be done by the user in a browser-gated dashboard
(Adsterra zone creation, Cloudflare DNS, IONOS nameservers, Google Search
Console, Vercel env vars). This skill turns "you need to do X in the dashboard"
into an illustrated, foolproof guide.

## Tooling

Playwright is a repo devDependency and Chromium is pre-installed in this
environment (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` — do NOT run
`playwright install`; if a pinned version complains, launch with
`executablePath: '/opt/pw-browsers/chromium'`).

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: 'step-01.png', fullPage: false });
```

There is also an existing automation script pattern at
`scripts/revive-admin.mjs` (login + navigate + act) — reuse its approach for
authenticated dashboards when the user provides credentials via env vars.

## Workflow

1. **Scope the task.** What exactly must the user click/type, and in which service? Check `HANDOFF.md` first — many dashboard paths (and dead ends) are already documented.
2. **Visit the real pages headlessly.** Navigate the actual dashboard/site/forum. For public pages (docs, forums, help articles), screenshot the relevant sections. For login-gated pages without credentials, screenshot the login page and the public docs, and describe the post-login path from documented knowledge — clearly marked as "expected view."
3. **Screenshot every decision point.** One screenshot per step where the user must look, click, or type. Save to the scratchpad, numbered (`step-01.png`, `step-02.png`…). Crop or set viewport so the relevant control is prominent.
4. **Annotate when possible.** Draw attention with Playwright before capture: `page.locator(sel).evaluate(el => el.style.outline = '4px solid red')`, or scroll the element into view and screenshot the element's bounding area.
5. **Assemble the guide.** Markdown document with this structure per step:
   - **Step N — imperative title** ("Click *Add a site*")
   - Screenshot
   - Exact text to type / option to choose (in `code` so it's copy-pasteable)
   - What the screen should look like after ("you'll see a green checkmark")
6. **Deliver.** Send the guide and images to the user (SendUserFile). Write in `caveman` voice — the user may be on a phone doing this one-handed.

## Quality bar

- Zero ambiguity: every step names the exact button label, tab name, or menu path (Dashboard → Websites → truegle.info → + Ad Unit).
- Include the direct URL for every step that has one, so the user can jump straight there.
- Include a "how to verify it worked" check at the end (a URL to load, a curl the agent will run next session).
- If a step can go wrong, add a one-line "If you see X instead → do Y."
- Never ask the user to do something an agent can do itself — automate first, instruct only for the human-only remainder.

## Standing targets (recurring guides)

- Adsterra: create non-adult zones (adult toggle OFF **before** first activation — it locks ON permanently), get zone keys, Anti-AdBlock CNAME target
- Cloudflare: DNS records, Pages env vars (`VITE_AD_DOMAIN`, `VITE_BACKEND_URL`), cache purge, build logs
- Vercel: backend env vars, redeploy
- IONOS: nameserver changes
- Google Search Console / Bing Webmaster: verification, sitemap submission, URL inspection
