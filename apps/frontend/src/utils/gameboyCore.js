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

  async loadRom(romBuffer) {
    if (!this.isInitialized) throw new Error('Emulator not initialized');
    await WasmBoy.loadROM(new Uint8Array(romBuffer));
    this.currentRom = romBuffer;
    return true;
  }

  async start() {
    if (!this.isInitialized || !this.currentRom) return false;
    await WasmBoy.play();
    return true;
  }

  async stop() {
    if (this.isInitialized && WasmBoy.isPlaying()) {
      await WasmBoy.pause();
    }
  }

  async reset() {
    if (!this.isInitialized || !this.currentRom) return false;
    await WasmBoy.reset();
    await WasmBoy.play();
    return true;
  }

  // button is one of BUTTON_KEYS (case-insensitive), pressed is boolean.
  // WasmBoy's setJoypadState wants the whole state each call, not a diff.
  setInput(button, pressed) {
    if (!this.isInitialized) return;
    const key = button.toUpperCase();
    if (!BUTTON_KEYS.includes(key)) return;
    this.buttonState[key] = pressed;
    WasmBoy.setJoypadState(this.buttonState);
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

export const gameboyCore = new GameBoyCore();

export async function fetchRom(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ROM: ${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}
