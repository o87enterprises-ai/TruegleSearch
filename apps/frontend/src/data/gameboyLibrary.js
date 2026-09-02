// Touch-playable Game Boy library for the Games search category.
//
// Every ROM here was independently verified before being bundled: cloned
// from the real source repo, license confirmed, and — where no prebuilt
// ROM existed upstream — built from source with a modern rgbds/GBDK-2020
// toolchain and checked to actually boot and respond to input in WasmBoy.
// No placeholders, no "coming soon" cards.
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
  {
    id: 'gb-wordyl',
    name: 'GB Wordyl',
    tagline: 'Guess the word, Game Boy style',
    romPath: '/roms/gb-wordyl.gb',
    icon: '📝',
    color: '#ffe66d',
    developer: 'bbbbbr',
    sourceUrl: 'https://github.com/bbbbbr/gb-wordyl',
    license: 'GPL-3.0',
    licenseUrl: 'https://www.gnu.org/licenses/gpl-3.0.html',
  },
  {
    id: 'libbet',
    name: 'Libbet and the Magic Floor',
    tagline: 'Roll and jump across a living puzzle floor',
    romPath: '/roms/libbet.gb',
    icon: '🧩',
    color: '#f7b731',
    developer: 'Damian Yerrick (pinobatch)',
    sourceUrl: 'https://github.com/pinobatch/libbet',
    license: 'Zlib',
    licenseUrl: 'https://github.com/pinobatch/libbet/blob/master/LICENSE',
  },
  {
    id: 'canyon-racer',
    name: 'Canyon Racer',
    tagline: 'Weave a ship down a scrolling canyon',
    romPath: '/roms/canyon-racer.gb',
    icon: '🚀',
    color: '#a29bfe',
    developer: 'bbbbbr',
    sourceUrl: 'https://github.com/bbbbbr/canyon-racer',
    license: 'CC BY-NC-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  },
  {
    id: 'flappy-boy',
    name: 'Flappy Boy',
    tagline: 'Tap to flap, dodge the pipes',
    romPath: '/roms/flappy-boy.gb',
    icon: '🐦',
    color: '#74b9ff',
    developer: 'Felipe Alfonso (bitnenfer)',
    sourceUrl: 'https://github.com/bitnenfer/FlappyBoy',
    license: 'MIT',
    licenseUrl: 'https://github.com/bitnenfer/FlappyBoy/blob/master/LICENSE',
  },
  {
    id: 'carazu',
    name: 'Carazu',
    tagline: 'A colorful platform-action adventure',
    romPath: '/roms/carazu.gb',
    icon: '🎮',
    color: '#e17055',
    developer: 'Mark Holtkamp (mholtkamp)',
    sourceUrl: 'https://github.com/mholtkamp/carazu',
    license: 'GPL-3.0',
    licenseUrl: 'https://www.gnu.org/licenses/gpl-3.0.html',
  },
  {
    id: 'adjustris',
    name: 'Adjustris',
    tagline: 'A block-dropping puzzle classic',
    romPath: '/roms/adjustris.gb',
    icon: '🧱',
    color: '#00b894',
    developer: 'tbsp',
    sourceUrl: 'https://github.com/tbsp/Adjustris',
    license: 'CC0 1.0 (public domain)',
    licenseUrl: 'https://github.com/tbsp/Adjustris/blob/master/LICENSE',
  },
  {
    id: 'plutos-corner',
    name: "Pluto's Corner",
    tagline: 'A sleepy cat platformer',
    romPath: '/roms/plutos-corner.gb',
    icon: '🐱',
    color: '#a67c1e',
    developer: 'bbbbbr',
    sourceUrl: 'https://github.com/bbbbbr/plutoscorner',
    license: 'CC BY-NC-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  },
  {
    id: 'breakout-lava-lamp',
    name: 'Breakout Lava-Lamp',
    tagline: 'Break the blocks, keep the lamp bubbling',
    romPath: '/roms/breakout-lava-lamp.gb',
    icon: '🧯',
    color: '#e84393',
    developer: 'bbbbbr',
    sourceUrl: 'https://github.com/bbbbbr/breakout-lava-lamp',
    license: 'GPL-3.0',
    licenseUrl: 'https://www.gnu.org/licenses/gpl-3.0.html',
  },
  {
    id: 'gb-corp',
    name: 'GB Corp',
    tagline: 'An idle Game Boy factory tycoon',
    romPath: '/roms/gb-corp.gb',
    icon: '🏭',
    color: '#636e72',
    developer: 'Dr. Ludos (bbbbbr fork)',
    sourceUrl: 'https://github.com/bbbbbr/GBcorp',
    license: 'MIT',
    licenseUrl: 'https://github.com/bbbbbr/GBcorp/blob/master/LICENSE',
  },
];

// Titles considered and rejected during verification — kept here so the
// next person doesn't re-walk the same dead ends:
//   - TangramGames/TobuTobuGirl, chrismaltby/gb-wordle: the repos named in
//     early research don't exist (404) — likely hallucinated citations.
//   - Sanqui/2048-gb (Zlib): real source, builds clean with a modern rgbds
//     after fixing legacy syntax, but the produced ROM renders a blank
//     white/black screen in WasmBoy under both DMG and CGB header flags —
//     a real emulation incompatibility, not a licensing issue.
//   - bbbbbr/gb-torch-effect: real prebuilt ROM (CC BY-NC-SA), but it's a
//     passive lighting-effect tech demo with no player goal, not a game.
//   - DonaldHays/snake-gb, huderlem/lazerpong, AntonioND/geometrix,
//     JustSid/Sushi, BonsaiDen/Tuff.gb, pinobatch/little-things-gb: real,
//     well-known, but no LICENSE file anywhere in the repo or README —
//     default copyright applies, so no redistribution right exists.
//   - ISSOtm/Aevilia-GB (Apache 2.0): real, license is fine, and most of
//     its ancient rgbds syntax was fixed, but its bundled DevSound audio
//     dependency has ~200 more of the same legacy errors and the game
//     itself is a full RPG, not a "simple game" — not worth finishing.
//   - flozz/evoland.gb: explicitly permits non-commercial ROM redistribution
//     (ideal license) and is buildable, but it's a fan port of Shiro
//     Games' commercial "Evoland" — reusing another studio's game concept
//     and trademark is a different risk category than an original
//     homebrew, so it's left out pending an explicit call on that.
//   - infinity-gbc: CC BY-NC-ND/SA but "incomplete alpha quality" per its
//     own README, and needs a heavily patched ancient GBDK fork to build.
//   - gb-archive/infinity-gbc, SimonLarsen/tobutobugirl-dx: real and
//     licensed, but require bespoke/ancient toolchains (custom GBDK forks,
//     multiple compiler versions) well beyond the effort/value here.
