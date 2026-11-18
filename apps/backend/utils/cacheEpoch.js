// The top-posts cache turns over once a day at 6:00 AM Pacific time.
//
// An "epoch" is the calendar date (in Pacific time) of the most recent 6:00 AM
// Pacific. Everything cached between one 6 AM and the next shares an epoch; at
// 6 AM the epoch changes and the cache is due a rebuild. America/Los_Angeles is
// resolved by Intl, so daylight saving is handled for us: 6 AM Pacific is
// 13:00 UTC in summer and 14:00 UTC in winter.
const TZ = 'America/Los_Angeles';
const REFRESH_HOUR = 6;

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

function pacificParts(ms) {
  const p = {};
  for (const { type, value } of fmt.formatToParts(new Date(ms))) p[type] = Number(value);
  return p; // { year, month, day, hour, minute } in Pacific time
}

/** 'YYYY-MM-DD' of the most recent 6:00 AM Pacific at or before `ms`. */
function epochId(ms = Date.now()) {
  const p = pacificParts(ms);
  let day = Date.UTC(p.year, p.month - 1, p.day);
  if (p.hour < REFRESH_HOUR) day -= 24 * 60 * 60 * 1000; // before 6 AM: still yesterday's cache
  return new Date(day).toISOString().slice(0, 10);
}

/** True during the 6 o'clock hour Pacific — when the daily rebuild belongs. */
function isRefreshHour(ms = Date.now()) {
  return pacificParts(ms).hour === REFRESH_HOUR;
}

module.exports = { epochId, isRefreshHour, REFRESH_HOUR, TZ };
