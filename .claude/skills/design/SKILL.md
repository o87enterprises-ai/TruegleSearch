---
name: design
description: Truegle design workflow — Framer-quality motion, 21st.dev component patterns, pro UI/UX process, never-static pages, and strict continuity with the Truegle brand identity and design-system.json. Use for any UI, page, component, animation, or visual-asset work.
---

# Design — Truegle Brand & UI/UX

## Brand identity (protected — never modify)

`design-system.json` at repo root is the authority. Its `constraints.protected`
list is inviolable:
- Background animations (Galaxy, Iridescence, Particles, Aurora, Prism, LaserFlow)
- The `TruegleLogo` component (design, sizing rules, colors)
- Primary brand colors used in animations (cyan glows, purple gradients)
- Animation timing/behavior patterns in background components

Everything new **extends** these. Dark backgrounds are the default canvas;
typography and spacing come from the design-system scales (8px base unit,
Tailwind semantic tokens listed in the JSON).

## The visual journey (page-level art direction)

Every page sits on the microcosm→macrocosm arc — respect it when creating or
restyling pages: Landing = atomic, Auth = cellular/molecular, Search = neural,
OSINT = planetary, Biased results = galactic, 404 = void. New pages must pick
their place on this arc; Extract already claimed a yellow-tinted starfield.

Mode theming is functional, not decorative: Blue = mainstream, Red =
alternative, Purple = skeptical, Ocean = privacy/OSINT, Green = simplified,
Yellow = extract. Components accept a `mode` prop and theme from the
`MODE_THEME` map — never hardcode a mode color.

## Never static

Every page must live: ambient background motion, entrance animations, and
micro-interactions. House style is framer-motion (already used —
QuickResultCard's slide-up + fade with spring easing is the reference feel):
- Entrances: slide-up + fade, spring easing, staggered children
- Ambient: canvas starfields/particles per the page's cosmic level
- Micro: pulsing accents (Zap icons, trending pill rotation every 4s), hover glows
- **Hard constraints:** WebGL components require a capability check + CSS fallback (the Prism/Aurora crash-loop incident); animation params live in refs, not state; never put animation phase in useEffect deps; respect `prefers-reduced-motion`; mobile-first portrait layouts with expandable desktop features.

## Workflow (pro UI/UX process)

1. **Reference before pixels.** Pull patterns from 21st.dev (component gallery) and Framer-grade sites for the interaction model; for blue-page surfaces the reference is Google itself (minimal clutter — see `tech` skill).
2. **Spec:** one short design note — purpose, cosmic level, mode theming, motion plan, mobile layout — before coding.
3. **Build with system tokens:** spacing/typography/padding from `design-system.json` semantic scales; Tailwind utilities, not ad-hoc values.
4. **Motion pass:** add entrance + ambient + micro layers; verify no jank on mobile (test at 360px width first).
5. **Continuity check:** does it look like Truegle? Logo treatment correct, brand cyan/purple present, dark canvas, ad slots wrapped in `AdColorWrapper` with the correct type (cpm=green "Sponsored", claim=yellow "Ad Spot", adult=red/blue "18+ Ad", reward=red/white "Watch & Earn").
6. **Verify in browser** (ponytail rule): run the app, watch the console, screenshot mobile + desktop.

## Accessibility (non-negotiable)

Contrast on dark backgrounds per the design system; `aria-live` on toasts;
labeled inputs; hidden inputs get `aria-hidden` + `tabIndex={-1}`; keyboard
paths for every interaction; animations must not trap focus or block reading.
