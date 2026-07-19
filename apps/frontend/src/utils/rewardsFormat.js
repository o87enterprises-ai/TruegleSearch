// Shared formatter for reward amounts stored in micros (millionths of a
// dollar; 1,000,000 micros = $1). Real per-event amounts are sub-cent, so a
// flat 2-decimal format would show "$0.00" for every honest earn — show more
// precision the smaller the amount is.
export const formatMicros = (micros) => {
  const dollars = Math.max(0, micros || 0) / 1e6;
  if (dollars >= 1) return `$${dollars.toFixed(2)}`;
  if (dollars >= 0.01) return `$${dollars.toFixed(4)}`;
  return `$${dollars.toFixed(6)}`;
};
