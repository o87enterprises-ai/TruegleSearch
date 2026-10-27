const express = require('express');

const router = express.Router();
const { rateLimitSearch } = require('../middleware/rateLimit');
const { PlayerHealthService } = require('../services/PlayerHealthService');

// A rough platform bucket, derived from the User-Agent and then discarded —
// see migrations/025_player_health.sql for why the raw string is never kept.
// iPad reports as "Macintosh" with touch points, same rule isIOS.js uses on
// the client; checked here too since the beacon can't be trusted to send the
// bucket itself (a stale client build should not be able to skew the data).
function platformOf(ua) {
  const s = String(ua || '');
  if (/iP(hone|od|ad)/.test(s) || (/Macintosh/.test(s) && /Mobile/.test(s))) return 'ios';
  if (/Android/.test(s)) return 'android';
  if (/Windows|Macintosh|Linux/.test(s) && !/Android|Mobile/.test(s)) return 'desktop';
  return 'other';
}

/**
 * POST /api/player/diagnostics  { kind?, reason, errorCode?, heard?, muted?, connection?, trace?, device?, browser? }
 * PUBLIC AND ANONYMOUS BY DESIGN, same rule as POST /api/media/signal: no
 * user, session or IP recorded. Fired automatically by the player the moment
 * it detects a stuck clip (see utils/playerDiagnostics.js) — never from a
 * tap, so a visitor never sees this happen. Always 200: a lost beacon must
 * never cost anyone a working player.
 */
router.post('/diagnostics', rateLimitSearch, async (req, res) => {
  const body = req.body || {};
  await PlayerHealthService.record({
    kind: body.kind,
    reason: body.reason,
    errorCode: body.errorCode,
    heard: body.heard,
    muted: body.muted,
    connection: body.connection,
    trace: body.trace,
    device: body.device,
    browser: body.browser,
    platform: platformOf(req.headers['user-agent']),
  });
  return res.json({ success: true });
});

module.exports = router;
