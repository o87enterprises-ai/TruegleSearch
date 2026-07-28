import React from 'react';

/**
 * FAQ block — renders a VISIBLE "Frequently asked questions" section AND the
 * matching FAQPage JSON-LD, kept in sync so it satisfies Google's structured-
 * data guideline (FAQ schema must reflect content actually visible on the page)
 * and gives AI Overviews / featured snippets clean question→answer pairs to
 * cite.
 *
 * Drives off a `faq` array of { q, a } from the page/post metadata. If a page
 * has none, it falls back to DEFAULT_FAQ so every content page still ships one
 * answerable Q&A. Pure/SSR-safe (no browser APIs) so it prerenders identically.
 */
export const DEFAULT_FAQ = [
  {
    q: 'What makes Truegle different from Google?',
    a: "Truegle is unbiased, serves results from multiple engines, and doesn't track users.",
  },
];

const FaqBlock = ({ faq, pageUrl, heading = 'Frequently asked questions' }) => {
  const items = Array.isArray(faq) && faq.length > 0 ? faq : DEFAULT_FAQ;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    ...(pageUrl ? { '@id': `${pageUrl}#faq` } : {}),
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };

  return (
    <section className="mt-10 pt-6 border-t border-gray-800" aria-labelledby="faq-heading">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h2 id="faq-heading" className="text-xl font-semibold text-white mb-4">{heading}</h2>
      <dl className="space-y-4">
        {items.map(({ q, a }, i) => (
          <div key={i}>
            <dt className="font-semibold text-white">{q}</dt>
            <dd className="mt-1 text-gray-300 leading-relaxed">{a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export default FaqBlock;
