# What the Ad Colors on Truegle Mean — and Why We Show Them

> **Draft status:** expansion for review (was ~462 words → ~950 words). Slug unchanged: `understanding-our-ad-color-system`. Added: a quick-reference table and a "Further reading" section linking to the pillar.
>
> ⚠️ **Accuracy correction:** the live version describes a "Watch & Earn" reward for *viewing* an ad (measured via IntersectionObserver) and links to `/rewards`. That model has been replaced by an **offer/conversion-based** Rewards Program, and the rewards UI is **currently disabled** while a conversion-tracking network is finalized. This draft rewrites that section to match reality and removes the dead `/rewards` link. Please confirm the wording.

_Every ad on Truegle is color-coded so you can tell at a glance what kind of ad it is and whether it benefits you directly. Here's what each color means._

Most search engines hide their ad infrastructure. You see a result, you may not even know it's paid placement, and you have no idea where the money flows. Truegle does the opposite: every ad slot on the platform carries a visible color-coded badge so you know exactly what you're looking at before you decide to engage.

## Quick reference

| Color | Ad type | What it means for you |
|-------|---------|-----------------------|
| **Yellow** | Available / house spot | Unsold inventory — no advertiser is paying to influence this slot right now. |
| **Neon green** | Contextual CPM ad | A real advertiser paid to appear; Truegle earns from the impression. Never affects rankings. |
| **Red + blue pulse** | Adult-content ad | Only ever shown behind a strict triple gate (see below). Most users never see one. |
| **Red with white border** | Rewards Program slot | Tied to the opt-in Rewards Program (currently being reworked — see below). |

## Yellow — available ad spots

A **yellow-bordered slot** is an unsold or house ad space — inventory we haven't filled with a paying advertiser yet. You'll see a "Claim This Spot" prompt. These slots exist so advertisers can see exactly where their placement would appear. If you're a business that wants to reach a privacy-conscious, independent-minded audience, yellow is your invitation.

Yellow means: _no third-party advertiser is paying to influence what you see here right now._

## Neon green — contextual CPM ads

A **neon apple-green border** marks a paid CPM (cost-per-thousand-impressions) ad — a display unit from our ad-network partner. These ads are contextual: matched to the page or query, not to a behavioral profile of you.

Green means: _a real advertiser paid to be here, and Truegle earns revenue from the impression._ We never use this revenue to influence search rankings — it funds server costs and the platform. Ads stay physically separate from organic results.

## Red and blue pulse — adult-content ads

A **pulsing red-and-blue glow** identifies an adult-content ad. These are only ever shown to users who meet all three conditions simultaneously: signed in with a verified account (our lightweight age signal), Safe Search set to Off, and searching for a query that contains adult-intent keywords.

If you don't meet all three conditions, you will never see a red-blue pulsing ad — ever. The triple gate is enforced both client-side and server-side. The bright, alternating pulse is intentional: adult ads should be unmistakably visible as such so users can make an informed choice about engaging with them.

## Red with white border — Rewards Program slots

A **red slot with a white border** is a Rewards Program ad. The Rewards Program lets opted-in users earn a share of real ad revenue.

**Important, and currently changing:** the program originally paid a small credit for *viewing* an ad. It has been reworked to be **offer/conversion-based** — you earn a revenue-share when you complete a sponsored offer (an install, sign-up, or purchase), because that's the event the ad network actually pays out on. While we finalize a conversion-tracking setup, **the Rewards Program is temporarily paused**, so you may not see this slot active. When it returns, this badge is the signal that a slot is tied to earnings.

## Why we do this

Truegle's core promise is transparency. That extends to how we make money. Color-coding every ad type means you're never left guessing whether something is organic content or paid placement, who benefits from the transaction, or whether content is age-appropriate. We think every search engine should work this way.

Transparency about ads is really the same value as transparency about *sources* — both are about never letting a hidden incentive quietly shape what you see. That's the thread running through everything we build, from labeled search results to labeled ads.

## Further reading

- [The Ultimate Digital Privacy & OSINT Resource Hub](/privacy-resource-hub) — the full guide to privacy, non-tracking search, OSINT tools, and safe access to information.
- [How Truegle delivers unbiased results](/blog/unbiased-search-engine-how-truegle-works) — why we don't accept paid placement in organic rankings.
- [Search without tracking](/blog/search-without-tracking-alternative-to-google) — how contextual ads let us keep the lights on without profiling you.
- [Advertise on Truegle](/advertise) — if you want to reach this audience.

## Summary

- Every Truegle ad carries a color-coded badge so you always know what you're looking at: yellow (available), neon green (contextual CPM), red-blue pulse (gated adult), red-with-white-border (Rewards).
- Ad revenue never influences organic rankings, and ads stay physically separate from results.
- The Rewards Program moved from pay-per-view to pay-per-completed-offer and is temporarily paused during that transition.
- The color system is transparency applied to money — the same principle as labeling sources. See the [Privacy & OSINT Resource Hub](/privacy-resource-hub) for the bigger picture.
