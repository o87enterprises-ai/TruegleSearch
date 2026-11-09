// POST /api/lang/classify — the language of a batch of Tube results, so the
// player's search can apply the same Local/Global filter the Feed does
// (services/ContentLang.js). Body: { items: [{ url, title }], lang }.
// Returns { items: [{ lang, audioLang, verdict }] } in the same order.
// Only titles and public video URLs are sent; nothing about the visitor.
const express = require('express');
const ContentLang = require('../services/ContentLang');

const router = express.Router();
const MAX_ITEMS = 60;

router.post('/classify', async (req, res) => {
  const raw = Array.isArray(req.body?.items) ? req.body.items.slice(0, MAX_ITEMS) : [];
  const lang = String(req.body?.lang || '').toLowerCase().split(/[-_]/)[0];
  const items = raw.map((r) => ({
    url: typeof r?.url === 'string' ? r.url.slice(0, 500) : '',
    title: typeof r?.title === 'string' ? r.title.slice(0, 300) : '',
  }));
  await ContentLang.annotateItems(items, { budgetMs: 2500 });
  return res.json({
    items: items.map((it) => ({
      lang: it.lang || 'und',
      audioLang: it.audioLang || null,
      verdict: /^[a-z]{2,3}$/.test(lang) ? ContentLang.verdict(it, lang) : 'unknown',
    })),
  });
});

module.exports = router;
