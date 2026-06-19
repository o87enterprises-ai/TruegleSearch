import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Everything here is local-only: a JSON file in the user's home directory.
// Nothing in this module makes a network request. Credentials you store with
// `creds set` sit on disk until *you* use them somewhere else; this tool
// never transmits them anywhere on its own.

const STATE_DIR = path.join(os.homedir(), '.truegle-ad-onboarding');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
  }
}

export function loadState() {
  ensureStateDir();
  if (!fs.existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function saveState(state) {
  ensureStateDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

export function getNetworkState(id) {
  const state = loadState();
  return state[id] || { applied: null, creds: {} };
}

export function markApplied(id) {
  const state = loadState();
  state[id] = state[id] || { applied: null, creds: {} };
  state[id].applied = new Date().toISOString();
  saveState(state);
  return state[id];
}

export function setCreds(id, pairs) {
  const state = loadState();
  state[id] = state[id] || { applied: null, creds: {} };
  state[id].creds = { ...state[id].creds, ...pairs };
  saveState(state);
  return state[id];
}

export function statePath() {
  return STATE_FILE;
}
