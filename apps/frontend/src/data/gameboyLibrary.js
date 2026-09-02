// Touch-playable Game Boy library for the Games search category.
//
// Every ROM here was independently verified before being bundled — the
// source repo, license, and file are all real and checked into
// public/roms. No placeholders, no ROMs "pending" a legal source.
export const GAMEBOY_LIBRARY = [
  {
    id: 'petris',
    name: 'Petris',
    tagline: 'Stack shapely pets, clear the board',
    romPath: '/roms/petris.gbc',
    icon: '🐾',
    color: '#4ecdc4',
    developer: 'bbbbbr',
    sourceUrl: 'https://github.com/bbbbbr/petris',
    license: 'CC BY-NC-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  },
];

// Titles considered and rejected during verification — kept here so the
// next person doesn't re-walk the same dead ends:
//   - TangramGames/TobuTobuGirl, chrismaltby/gb-wordle: the repos named in
//     early research don't exist (404) — likely hallucinated citations.
//   - Sanqui/2048-gb (Zlib): real source, builds clean with a modern rgbds
//     after a few legacy-syntax fixes, but the produced ROM renders a blank
//     white/black screen in WasmBoy (checked both DMG and CGB header
//     flags) — a real emulation incompatibility, not a licensing issue.
//     Left unshipped rather than landing a dead card.
//   - bbbbbr/gb-wordyl, canyon-racer: real, permissively/CC-licensed, but
//     ship no ROM in-repo or in GitHub releases — only via itch.io, which
//     this environment's egress proxy blocks. Would need GBDK-2020
//     installed to build from source.
//   - bbbbbr/gb-torch-effect: real prebuilt ROM (CC BY-NC-SA), but it's a
//     passive lighting-effect tech demo, not a game.
