/**
 * Agent API key middleware (Agent Commerce Network scaffold).
 *
 * agentKeyAuth is the full quota gate used on all agent-facing endpoints:
 * it looks up the key, returns 402 with upgrade info if quota is exhausted,
 * otherwise decrements quota and attaches the key record to req.agentKey.
 *
 * agentKeyIdentifyOnly is a lighter variant used ONLY on /purchase-key. That
 * endpoint exists to rescue an agent whose quota just hit 0 — gating it with
 * agentKeyAuth would mean an exhausted key could never reach the endpoint
 * meant to upgrade it. agentKeyIdentifyOnly still requires a valid, non-
 * revoked key, it just doesn't check or consume quota.
 */

const AgentCommerceService = require('../services/AgentCommerceService');

function extractRawKey(req) {
  const header = req.headers['x-agent-api-key'];
  if (header) return header;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

const agentKeyAuth = async (req, res, next) => {
  try {
    const rawKey = extractRawKey(req);
    if (!rawKey) {
      return res.status(401).json({
        error: 'Agent API key required',
        message: 'Provide your key via the X-Agent-Api-Key header or Authorization: Bearer <key>.',
      });
    }

    const keyRecord = await AgentCommerceService.findKeyByRawValue(rawKey);
    if (!keyRecord) {
      return res.status(401).json({
        error: 'Invalid agent API key',
        message: 'This key is invalid, revoked, or unknown.',
      });
    }

    if (keyRecord.quota_remaining <= 0) {
      return res.status(402).json(AgentCommerceService.quotaExceededResponse(keyRecord));
    }

    await AgentCommerceService.consumeQuota(keyRecord);
    req.agentKey = keyRecord;
    next();
  } catch (error) {
    res.status(500).json({
      error: 'Agent authentication failed',
      message: 'Unable to verify agent API key.',
    });
  }
};

const agentKeyIdentifyOnly = async (req, res, next) => {
  try {
    const rawKey = extractRawKey(req);
    if (!rawKey) {
      return res.status(401).json({
        error: 'Agent API key required',
        message: 'Provide your key via the X-Agent-Api-Key header or Authorization: Bearer <key>.',
      });
    }

    const keyRecord = await AgentCommerceService.findKeyByRawValue(rawKey);
    if (!keyRecord) {
      return res.status(401).json({
        error: 'Invalid agent API key',
        message: 'This key is invalid, revoked, or unknown.',
      });
    }

    req.agentKey = keyRecord;
    next();
  } catch (error) {
    res.status(500).json({
      error: 'Agent authentication failed',
      message: 'Unable to verify agent API key.',
    });
  }
};

module.exports = { agentKeyAuth, agentKeyIdentifyOnly };
