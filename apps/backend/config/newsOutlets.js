/**
 * THE NEWS LANE'S OUTLETS (owner, 2026-11-18).
 *
 * The Feed's News lane used to be a single YouTube search for "world news today", and the
 * index kept answering with one network's clips ("it only shows NBC"). It now also reads each
 * outlet's own uploads — the public, keyless channel RSS — and interleaves them newest-first
 * so no outlet can fill the lane. The earlier "name no channels" rule (see NewsVideos.js) was
 * a design choice; the owner asked for the major outlets by name, so this is the one place
 * they are listed.
 *
 * Every channelId below was checked against its feed (title and a same-day upload) on
 * 2026-11-18. To add an outlet: find its channel id, open
 * https://www.youtube.com/feeds/videos.xml?channel_id=<id>, confirm the title, add a line.
 */
const NEWS_OUTLETS = [
  { name: 'BBC News', channelId: 'UC16niRr50-MSBwiO3YDb3RA' },
  { name: 'CNN', channelId: 'UCupvZG-5ko_eiXAupbDfxWw' },
  { name: 'Fox News', channelId: 'UCXIJgqnII2ZOINSWNOGFThA' },
  { name: 'NBC News', channelId: 'UCeY0bbntWzzVIaj2z3QigXg' },
  { name: 'CBS News', channelId: 'UC8p1vwvWtl6T73JiExfWs1g' },
  { name: 'ABC News', channelId: 'UCBi2mrWuNuyYy4gbM6fU18Q' },
  { name: 'MS NOW', channelId: 'UCaXkIU1QidjPwiAYu6GcHjg' },
  { name: 'Newsmax', channelId: 'UCx6h-dWzJ5NpAlja1YsApdg' },
  { name: 'Al Jazeera English', channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg' },
  { name: 'WION', channelId: 'UC_gUM8rL-Lrg6O3adPW9K1g' },
  { name: 'Sky News', channelId: 'UCoMdktPbSTixAyNGwb-UYkQ' },
  { name: 'Reuters', channelId: 'UChqUTb7kYRX8-EiaN3XFrSQ' },
  { name: 'Associated Press', channelId: 'UC52X5wxOL_s5yw0dQk7NtgA' },
  { name: 'PBS NewsHour', channelId: 'UC6ZFN9Tx6xh-skXCuRHCDpQ' },
  { name: 'DW News', channelId: 'UCknLrEdhRCp1aegoMqRaCZg' },
  { name: 'FRANCE 24 English', channelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg' },
  { name: 'euronews', channelId: 'UCSrZ3UV4jOidv8ppoVuvW9Q' },
  { name: 'NDTV', channelId: 'UCZFMm1mMw0F81Z37aaEzTUA' },
  { name: 'CNBC', channelId: 'UCvJJ_dzjViJCoLf5uKUTwoA' },
  { name: 'Bloomberg Television', channelId: 'UCIALMKvObZNtJ6AmdCLP7Lg' },
  { name: 'The Weather Channel', channelId: 'UCGTUbwceCMibvpbd2NaIP7A' },
];

module.exports = { NEWS_OUTLETS };
