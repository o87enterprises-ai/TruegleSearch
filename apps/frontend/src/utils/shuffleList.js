// Shuffle a playlist's tracks into a new order. Never mutates the list it is
// given — a saved list keeps its own order, and "Shuffle" only changes the
// order it PLAYS in. Fisher–Yates, so every order is equally likely.
// `rng` is injectable so the order can be pinned in a test.
export function shuffleList(items, rng = Math.random) {
  const out = [...(items || [])];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
