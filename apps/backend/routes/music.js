const express = require('express');
const { similarArtists } = require('../services/MusicSimilarity');

const router = express.Router();

/**
 * GET /api/music/similar?artist=Radiohead
 * PUBLIC. Artists people listen to alongside this one, for the player's Radio
 * switch. Only the artist name leaves Truegle — nothing about the listener.
 */
router.get('/similar', async (req, res) => {
  const artist = String(req.query.artist || '').trim();
  if (!artist) return res.status(400).json({ error: 'artist is required' });
  const result = await similarArtists(artist);
  // A day in the browser too: similar-artist lists change slowly.
  res.set('Cache-Control', 'public, max-age=86400');
  return res.json(result);
});

module.exports = router;
