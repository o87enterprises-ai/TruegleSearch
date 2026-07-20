import React from 'react';
import { Link } from 'react-router-dom';

/*
 * /advertise — the media kit + sales page.
 *
 * This is the asset that converts house-ad inventory into paid placements:
 * it states who the audience is, what formats are for sale, and how to buy.
 * Pricing is flat-rate and tracking-free, which is itself the pitch to
 * privacy-conscious advertisers (VPNs, open-source tools, indie dev products).
 *
 * Numbers below are placeholders — update AUDIENCE / PACKAGES with real figures
 * from your analytics before sending this to advertisers.
 */

const AUDIENCE = [
  { stat: 'Privacy-first', label: 'No tracking, no cookies, no profiling — by design' },
  { stat: 'EU & intl.', label: 'High-value Netherlands + European reach' },
  { stat: 'Tech-savvy', label: 'Developers, researchers, privacy advocates' },
];

const PACKAGES = [
  {
    name: 'Native In-Results',
    zone: 'search-inline',
    format: '300×250',
    price: '€199',
    period: '/ month',
    blurb: 'A clean sponsored card placed within search results.',
    features: ['300×250 native unit', 'No tracking pixels', 'Up to 1 advertiser per slot'],
    variant: 'blue',
  },
  {
    name: 'Sidebar Sponsor',
    zone: 'search-sidebar',
    format: '300×600',
    price: '€349',
    period: '/ month',
    blurb: 'Persistent presence beside every search session.',
    features: ['300×600 sidebar unit', 'Category-aligned placement', 'Monthly impression report'],
    variant: 'purple',
    featured: true,
  },
  {
    name: 'Leaderboard',
    zone: 'results-leaderboard',
    format: '728×90',
    price: '€499',
    period: '/ month',
    blurb: 'Top-of-results banner — maximum visibility.',
    features: ['728×90 leaderboard', 'First impression on the page', 'Priority placement'],
    variant: 'green',
  },
];

const cardAccent = {
  blue: 'from-blue-500/15 to-cyan-500/15 border-blue-400/40',
  purple: 'from-purple-500/20 to-pink-500/20 border-purple-400/60',
  green: 'from-emerald-500/15 to-green-500/15 border-emerald-400/40',
};

const MAILTO =
  'mailto:truegleai@proton.me?subject=Advertising%20on%20Truegle&body=Hi%20Truegle%20team%2C%0A%0AI%27d%20like%20to%20advertise.%20Here%27s%20what%20I%27m%20looking%20for%3A%0A%0APackage%3A%0ABudget%3A%0AProduct%2FURL%3A%0A';

const Advertise = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-block text-xs uppercase tracking-widest text-emerald-400/80 mb-3">
            Advertise on Truegle
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Reach a privacy-first audience.{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Without the creep factor.
            </span>
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Truegle is an unbiased, tracking-free search engine. Our users opt out
            of the surveillance web — which makes them exactly the audience that
            privacy tools, open-source projects, and indie products want to reach.
          </p>
          <a
            href={MAILTO}
            className="inline-block mt-8 px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold shadow-lg hover:opacity-90 transition-all"
          >
            Book a placement
          </a>
        </div>

        {/* Audience */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          {AUDIENCE.map((a) => (
            <div
              key={a.stat}
              className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center"
            >
              <div className="text-2xl font-bold text-emerald-400 mb-1">{a.stat}</div>
              <div className="text-sm text-white/70">{a.label}</div>
            </div>
          ))}
        </div>

        {/* Why us */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-center">Why advertise here</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ['Flat-rate, no auctions', 'You know your cost up front. No CPM roulette, no surprise spend.'],
              ['No tracking, ever', 'Clean placements only. Nothing that gets you — or us — flagged.'],
              ['Aligned audience', 'Privacy, dev, and research-minded users who actually click intentional ads.'],
              ['Human-reviewed', 'Every advertiser is vetted. No malvertising, no junk next to your brand.'],
            ].map(([title, body]) => (
              <div key={title} className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <div className="font-semibold mb-1">{title}</div>
                <div className="text-sm text-white/70">{body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Packages */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-2 text-center">Placements</h2>
          <p className="text-center text-white/60 mb-8 text-sm">
            Flat monthly rate. Cancel anytime. Intro pricing for launch partners.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PACKAGES.map((pkg) => (
              <div
                key={pkg.zone}
                className={`relative p-6 rounded-2xl bg-gradient-to-br border-2 ${cardAccent[pkg.variant]} ${
                  pkg.featured ? 'md:-translate-y-2 shadow-2xl' : ''
                }`}
              >
                {pkg.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-purple-500 text-xs font-semibold">
                    Most popular
                  </div>
                )}
                <div className="text-sm text-white/60 mb-1">
                  {pkg.format}
                </div>
                <div className="text-lg font-bold mb-2">{pkg.name}</div>
                <div className="mb-3">
                  <span className="text-3xl font-bold">{pkg.price}</span>
                  <span className="text-white/60 text-sm">{pkg.period}</span>
                </div>
                <p className="text-sm text-white/70 mb-4">{pkg.blurb}</p>
                <ul className="space-y-2 mb-6">
                  {pkg.features.map((f) => (
                    <li key={f} className="text-sm text-white/80 flex items-start gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={MAILTO}
                  className="block text-center px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 font-semibold transition-all"
                >
                  Reserve this slot
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Adsterra Publisher Referral */}
        <div className="mb-16 p-8 rounded-2xl bg-gradient-to-br from-yellow-500/8 to-orange-500/8 border border-yellow-500/20">
          <div className="text-center mb-6">
            <div className="inline-block text-xs uppercase tracking-widest text-yellow-400/80 mb-2">
              For Website Owners &amp; Publishers
            </div>
            <h2 className="text-2xl font-bold mb-2">Monetize your site with Adsterra</h2>
            <p className="text-white/60 max-w-xl mx-auto text-sm">
              We partner with Adsterra to run ads on Truegle. If you own a website and want to
              do the same, sign up through our referral link — we earn 5% of your revenue
              lifetime at no cost to you, which helps keep Truegle development going.
            </p>
          </div>

          {/* 728×90 referral banner */}
          <div className="flex justify-center mb-5">
            <a
              href="https://beta.publishers.adsterra.com/referral/Pqd4tGsBZw"
              rel="nofollow noopener noreferrer"
              target="_blank"
              aria-label="Join Adsterra as a publisher via Truegle's referral link"
            >
              <img
                src="https://landings-cdn.adsterratech.com/referralBanners/png/728%20x%2090%20px.png"
                alt="Adsterra — join as a publisher"
                width={728}
                height={90}
                style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
              />
            </a>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://beta.publishers.adsterra.com/referral/Pqd4tGsBZw"
              rel="nofollow noopener noreferrer"
              target="_blank"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-sm hover:opacity-90 transition-all"
            >
              Join Adsterra as a publisher →
            </a>
            <p className="text-white/35 text-xs">
              5% lifetime revenue share · no cost to you · instant approval for most sites
            </p>
          </div>
        </div>

        {/* Contact */}
        <div className="text-center p-8 rounded-2xl bg-white/5 border border-white/10">
          <h2 className="text-2xl font-bold mb-2">Let's talk</h2>
          <p className="text-white/70 mb-6 max-w-xl mx-auto">
            Custom campaigns, longer flights, or affiliate partnerships welcome.
            Tell us about your product and we'll find the right fit.
          </p>
          <a
            href={MAILTO}
            className="inline-block px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold shadow-lg hover:opacity-90 transition-all"
          >
            truegleai@proton.me
          </a>
          <div className="mt-6 text-sm text-white/50">
            <Link to="/" className="hover:text-white/80">← Back to Truegle</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Advertise;
