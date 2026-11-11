// WasmBoy (Game Boy / Game Boy Color WebAssembly core) integration.
// WasmBoy itself is free/open-source (GPL-3.0-or-later) and ships no game
// data — the ROMs we load from /roms are separately licensed per title,
// see src/data/gameboyLibrary.js for attribution.
import { WasmBoy } from 'wasmboy';

const BUTTON_KEYS = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'A', 'B', 'START', 'SELECT'];

class GameBoyCore {
  constructor() {
    this.isInitialized = false;
    this.currentRom = null;
    this.buttonState = { UP: false, DOWN: false, LEFT: false, RIGHT: false, A: false, B: false, START: false, SELECT: false };
    // True only while a ROM is loaded and playing. WasmBoy's joypad has no worker to talk to
    // before that, and throws if asked (owner, 2026-11-11: pressing a key while a game was
    // still loading raised an uncaught error and the press was lost).
    this.running = false;
  }

  // OUR CONTROLS ARE THE ONLY INPUT (owner, 2026-11-11: Astro Attack not working on desktop).
  // WasmBoy switches its OWN joypad on every time a ROM loads, and its render loop then calls
  // updateController() on EVERY FRAME: it replaces whatever we last sent with the state of ITS
  // keyboard (arrows, X/Z, Enter = Start, Shift = Select, WASD on an analog stick) and any
  // gamepad — all released — so a button held on screen was wiped a frame later, and its
  // built-in keys clashed with ours (Enter would have been Start). Off, the joypad state is
  // exactly what setInput() says. It must be repeated after every loadROM/reset, which turn it
  // back on.
  _takeOverJoypad() {
    try { WasmBoy.disableDefaultJoypad(); } catch { /* nothing to disable yet */ }
  }

  async initialize(canvasElement) {
    WasmBoy.setCanvas(canvasElement);
    await WasmBoy.config({
      isGbcColorizationEnabled: true,
      audioBatchProcessing: true,
      timersBatchProcessing: false,
      audioAccumulateSamples: true,
      graphicsBatchProcessing: false,
    });
    this.isInitialized = true;
    return true;
  }

  async loadRom(romBuffer, patches = []) {
    if (!this.isInitialized) throw new Error('Emulator not initialized');
    await WasmBoy.loadROM(applyCompatPatches(new Uint8Array(romBuffer), patches));
    this._takeOverJoypad();
    this.currentRom = romBuffer;
    return true;
  }

  async start() {
    if (!this.isInitialized || !this.currentRom) return false;
    await WasmBoy.play();
    this._takeOverJoypad();
    this.running = true;
    this._sendInput(); // a key already held while the game was loading counts from the first frame
    return true;
  }

  async stop() {
    this.running = false;
    if (this.isInitialized && WasmBoy.isPlaying()) {
      await WasmBoy.pause();
    }
  }

  async reset() {
    if (!this.isInitialized || !this.currentRom) return false;
    await WasmBoy.reset();
    await WasmBoy.play();
    this._takeOverJoypad();
    this._sendInput();
    return true;
  }

  // button is one of BUTTON_KEYS (case-insensitive), pressed is boolean.
  // WasmBoy's setJoypadState wants the whole state each call, not a diff.
  setInput(button, pressed) {
    if (!this.isInitialized) return;
    const key = button.toUpperCase();
    if (!BUTTON_KEYS.includes(key)) return;
    this.buttonState[key] = pressed;   // remembered even if the game is not running yet
    this._sendInput();
  }

  _sendInput() {
    if (!this.running) return;
    try {
      WasmBoy.setJoypadState(this.buttonState);
    } catch {
      // The core went away between the check and the call (the player closed): nothing to tell.
    }
  }

  // For tests and debugging: is the core actually running, and at what frame rate?
  status() {
    if (!this.isInitialized) return { initialized: false };
    return { initialized: true, running: this.running, playing: WasmBoy.isPlaying(), fps: WasmBoy.getFPS() };
  }

  async resumeAudio() {
    try {
      await WasmBoy.resumeAudioContext();
    } catch {
      // Requires a user gesture first — the touch/click that starts the
      // game satisfies that, so a failed early call here is expected.
    }
  }
}

/**
 * Load-time compatibility tweaks (see `compat` in data/gameboyLibrary.js). Applied to a COPY in
 * memory; the file on disk and the downloaded bytes are never changed. A patch is applied only if
 * EVERY byte it expects is there (its own byte plus the `context` around it), so a ROM that was
 * replaced by a different build is left exactly as it is rather than corrupted.
 * Returns the bytes to load (the same array when nothing applied).
 */
export function applyCompatPatches(bytes, patches = []) {
  let out = bytes;
  for (const p of patches) {
    const seen = [[p.at, p.expect], ...(p.context || [])];
    if (!seen.every(([at, v]) => bytes[at] === v)) continue;
    if (out === bytes) out = bytes.slice();
    out[p.at] = p.set;
  }
  return out;
}

export const gameboyCore = new GameBoyCore();

export async function fetchRom(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ROM: ${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}
