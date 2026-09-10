import React from 'react';
import { Link } from 'react-router-dom';

/*
 * /advertise — kept as a URL, no longer a media kit.
 *
 * This page used to sell placements: audience stats, packages, a rate card,
 * a "contact us to buy" call to action. Truegle removed advertising in full on
 * 2026-08-24 (docs/AD-POLICY.md), and that policy is explicit that it covers
 * "no networks, no house ads, no smartlinks, no affiliate ad units" and that
 * "this is not a pause". A live sales page for inventory that no longer exists
 * is a false claim on our own site, and for a product whose entire pitch is
 * trust, that is a worse problem than a missing page.
 *
 * DELETED RATHER THAN REDIRECTED, but the ROUTE IS KEPT. The URL is indexed
 * and linked; 404ing it would throw away a page people arrive on with a real
 * question ("can I advertise here?") and answer them with nothing. They get
 * the true answer instead, which is a better first impression of the brand
 * than the media kit ever was.
 */
export default function Advertise() {
  return (
    <div className="min-h-screen bg-black text-white px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Truegle doesn&apos;t sell advertising
        </h1>

        <p className="text-white/70 leading-relaxed mb-4">
          There is no ad inventory here, and no rate card. Advertising was
          removed from Truegle in full on 24 August 2026 — no ad networks, no
          house ads, no sponsored placements, no affiliate units, and no
          cookie banner asking permission to measure any of it. Truegle sets
          zero cookies.
        </p>

        <p className="text-white/70 leading-relaxed mb-4">
          It is not a pause or a policy under review. The previous approach
          tried to make advertising safe by constraining it, and those
          constraints held — but the constraints existed because the
          underlying product pulled against ours. Truegle is no longer run on
          a profit and loss basis. It exists to offer an alternative to the
          search monopoly, and advertising was the last thing pulling the
          other way.
        </p>

        <p className="text-white/70 leading-relaxed mb-8">
          The rule is enforced in the build, not just written down: a check
          runs on every deploy and fails it if an ad network reappears.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/privacy"
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-sm"
          >
            How we handle your data
          </Link>
          <Link
            to="/about"
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors text-sm"
          >
            About Truegle
          </Link>
        </div>

        {/* The one thing a visitor to this page might still legitimately want.
            Naming it is not a solicitation — it is the honest answer to
            "then how is this funded", which is the obvious next question. */}
        <p className="text-white/40 text-xs mt-10 leading-relaxed">
          Building something aligned with an independent, tracking-free search
          engine? We are not selling placements, but we do read our mail:{' '}
          <a href="mailto:truegleai@proton.me" className="text-white/60 hover:text-white/80 underline">
            truegleai@proton.me
          </a>
        </p>
      </div>
    </div>
  );
}
