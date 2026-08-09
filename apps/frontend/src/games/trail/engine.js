// TRAIL — the drawing surface.
//
// TWO LAYERS ON ONE CANVAS, and the reason is legibility.
//
// The world is drawn to a 320×180 offscreen buffer and blitted up at an
// INTEGER scale with smoothing off, which is what makes the art read as
// pixel art instead of as a blurry photograph of pixel art. Text does not go
// through that: at 320×180 the system font is about six pixels tall, and
// nearest-neighbour scaling turns six-pixel type into rubble. So text is
// drawn straight onto the visible canvas at device resolution, sized in
// multiples of the same scale factor. Sharp letters, chunky world, one canvas
// element, no second DOM node to keep in sync.
//
// The owner chose the system font over a bitmap sheet, and this is the price
// of that choice being paid somewhere sensible.

export const W = 320;
export const H = 180;

// PICO-8, exactly. Indexed rather than named so drawing code reads like the
// palette it is: `px(x, y, 8)` is red, the way it would be in the original.
export const PAL = [
  '#000000', '#1d2b53', '#7e2553', '#008751',
  '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
  '#ff004d', '#ffa300', '#ffec27', '#00e436',
  '#29adff', '#83769c', '#ff77a8', '#ffccaa',
];
export const UI = PAL[7]; // near-white, reserved for interface text

/**
 * Deterministic RNG. The roadside is generated from a seed rather than stored,
 * so it costs nothing — but it has to be STABLE, or the scenery reshuffles
 * itself on every frame and the whole thing crawls with static.
 */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function createScreen(canvas) {
  const buf = document.createElement('canvas');
  buf.width = W; buf.height = H;
  const b = buf.getContext('2d');
  const c = canvas.getContext('2d');
  b.imageSmoothingEnabled = false;
  c.imageSmoothingEnabled = false;

  let scale = 1; let ox = 0; let oy = 0;

  const resize = () => {
    const host = canvas.parentElement;
    if (!host) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = host.clientWidth;
    const ch = host.clientHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    // INTEGER, floored, never below 1. A fractional scale is the difference
    // between crisp and smeared, and it is invisible in a screenshot until
    // you look at a diagonal.
    scale = Math.max(1, Math.floor(Math.min(canvas.width / W, canvas.height / H)));
    ox = Math.floor((canvas.width - W * scale) / 2);
    oy = Math.floor((canvas.height - H * scale) / 2);
    c.imageSmoothingEnabled = false;
  };

  return {
    buf: b,
    resize,
    get scale() { return scale; },
    /** Wipe the world buffer to a palette index. */
    clear(col = 0) { b.fillStyle = PAL[col]; b.fillRect(0, 0, W, H); },
    /** A rect in world pixels. Everything is built from this. */
    rect(x, y, w, h, col) {
      b.fillStyle = PAL[col];
      b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    },
    /** Blit the world up, then hand back the visible context for text. */
    present() {
      c.fillStyle = PAL[0];
      c.fillRect(0, 0, canvas.width, canvas.height);
      c.imageSmoothingEnabled = false;
      c.drawImage(buf, 0, 0, W, H, ox, oy, W * scale, H * scale);
      return { ctx: c, scale, ox, oy };
    },
  };
}

/**
 * Text, at device resolution, positioned in WORLD coordinates so callers can
 * think in one coordinate system.
 *
 * @param size  in world pixels; multiplied by the scale factor internally.
 */
export function text(view, str, x, y, { size = 8, col = UI, align = 'left', max = 0 } = {}) {
  const { ctx, scale, ox, oy } = view;
  ctx.font = `${size * scale}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textBaseline = 'top';
  ctx.textAlign = align;
  ctx.fillStyle = col;
  ctx.fillText(str, ox + x * scale, oy + y * scale, max ? max * scale : undefined);
}

/**
 * Greedy word wrap, measured against the real font so it is right at any size.
 * Returns the lines; the caller draws them, because callers want to know how
 * many there were before committing to a layout.
 */
export function wrap(view, str, maxWorldWidth, size = 8) {
  const { ctx, scale } = view;
  ctx.font = `${size * scale}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const limit = maxWorldWidth * scale;
  const out = [];
  let line = '';
  for (const word of String(str).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > limit && line) { out.push(line); line = word; } else { line = next; }
  }
  if (line) out.push(line);
  return out;
}
