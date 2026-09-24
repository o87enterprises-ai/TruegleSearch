// Shrink a photo before it leaves the device.
//
// A phone photo is 3-5 MB, ~4-7 MB once base64'd into a JSON body. Vercel
// refuses any function request body over 4.5 MB at its edge — before our code
// runs, and without CORS headers — so the browser saw "no response" and chat
// said the AI "could not be reached". The backend's own 8 MB limit never got a
// say. 1280px on the long side is plenty for a vision model to read text and
// detail, and lands around 150-300 KB as JPEG.

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

/**
 * @param {string} dataUrl a data:image/... URL
 * @returns {Promise<string>} a JPEG data URL no larger than maxSide on its long
 *   side — or the input unchanged if it is already small, is not a raster
 *   image, or cannot be decoded here (the server's own checks still apply).
 */
export async function downscaleImage(dataUrl, { maxSide = 1280, quality = 0.82 } = {}) {
  if (typeof dataUrl !== 'string' || !/^data:image\/(png|jpe?g|webp|bmp|heic|heif)/i.test(dataUrl)) return dataUrl;
  try {
    const img = await loadImage(dataUrl);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return dataUrl;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    // Already small in both senses — leave it byte-for-byte alone.
    if (scale === 1 && dataUrl.length < 1_000_000) return dataUrl;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    // JPEG has no alpha: paint white first so transparent PNGs don't go black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return dataUrl;
  }
}

export default downscaleImage;
