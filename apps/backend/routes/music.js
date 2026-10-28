const express = require('express');
const { similarArtists, artistForTitle, identifyQuery } = require('../services/MusicSimilarity');

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

/**
 * GET /api/music/artist?title=Song%20Name%20(Lyrics)
 * PUBLIC. The artist who recorded a song, from MusicBrainz — for Radio, when
 * the title and channel name no artist. Only the title leaves Truegle.
 */
router.get('/artist', async (req, res) => {
  const title = String(req.query.title || '').trim();
  if (!title) return res.status(400).json({ error: 'title is required' });
  const result = await artistForTitle(title);
  res.set('Cache-Control', 'public, max-age=86400');
  return res.json(result);
});

/**
 * GET /api/music/identify?q=larussel%20tweedlee%20dee
 * PUBLIC. Who and what a song search was for — { artist, track }, each null when
 * the query is not recognisably a song. Stream uses it to follow the artist the
 * listener asked for when the clip they pressed names nobody. Only the query
 * text leaves Truegle — nothing about the listener.
 */
router.get('/identify', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q is required' });
  const result = await identifyQuery(q);
  res.set('Cache-Control', 'public, max-age=86400');
  return res.json(result);
});

module.exports = router;
