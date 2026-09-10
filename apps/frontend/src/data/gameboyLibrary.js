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
  {
    id: 'fgb',
    name: 'FGB',
    tagline: 'A weird and wonderful action odyssey',
    romPath: '/roms/fgb.gb',
    icon: '🌋',
    color: '#c0511f',
    developer: 'Abe Pralle (AbePralle)',
    sourceUrl: 'https://github.com/AbePralle/FGB',
    license: 'MIT (code) / CC (assets)',
    licenseUrl: 'https://github.com/AbePralle/FGB/blob/main/LICENSE',
  },
  {
    id: 'minesweepgb',
    name: 'minesweepGB',
    tagline: 'Classic Minesweeper, pocket-sized',
    romPath: '/roms/minesweepgb.gb',
    icon: '💣',
    color: '#95a5a6',
    developer: 'lancekindle',
    sourceUrl: 'https://github.com/lancekindle/minesweepGB',
    license: 'GPL-3.0',
    licenseUrl: 'https://www.gnu.org/licenses/gpl-3.0.html',
  },
  {
    id: 'quadratino',
    name: 'Quadratino',
    tagline: 'A pocket-sized snake clone',
    romPath: '/roms/quadratino.gb',
    icon: '🟩',
    color: '#27ae60',
    developer: 'Antonio Vivace (avivace)',
    sourceUrl: 'https://github.com/avivace/quadratino',
    license: 'GPL-3.0',
    licenseUrl: 'https://www.gnu.org/licenses/gpl-3.0.html',
  },
  {
    id: 'squishy-turtle',
    name: 'Squishy the Turtle',
    tagline: 'A Ludum Dare platformer, shell and all',
    romPath: '/roms/squishy-turtle.gb',
    icon: '🐢',
    color: '#2ecc71',
    developer: 'Chris Anderson (cppchriscpp)',
    sourceUrl: 'https://github.com/cppchriscpp/SquishyTheTurtle',
    license: 'MIT',
    licenseUrl: 'https://github.com/cppchriscpp/SquishyTheTurtle/blob/master/LICENSE',
  },
  {
    id: 'guns-riders',
    name: 'Guns & Riders',
    // Honest, not a marketing genre. It is a Wild-West shooting gallery —
    // outlaws pop up, you shoot before they get past you — not a
    // side-scrolling run-and-gun. See the rejected-list entry below for why
    // it isn't billed as one.
    tagline: 'Wild-West shooting gallery — outlaws pop up, don\'t miss',
    romPath: '/roms/gunsriders.gb',
    icon: '🤠',
    color: '#d35400',
    developer: 'J.M. Climent (kanfor)',
    sourceUrl: 'https://github.com/kanfor/gunsridersgameboy',
    license: 'GPL-3.0',
    licenseUrl: 'https://www.gnu.org/licenses/gpl-3.0.html',
  },
  {
    id: 'astro-attack',
    name: 'Astro Attack',
    // Also honest about the genre: this is dodge-and-survive, no shooting —
    // asteroid shadows warn you where to not be standing.
    tagline: 'Dodge falling asteroids, survive as long as you can',
    romPath: '/roms/astroattack.gb',
    icon: '☄️',
    color: '#0984e3',
    developer: 'Fisch03',
    sourceUrl: 'https://github.com/Fisch03/Astro-Attack',
    license: 'MIT',
    licenseUrl: 'https://github.com/Fisch03/Astro-Attack/blob/main/LICENSE',
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
//   - "Deadeus" (izma.itch.io/deadeus): a paid GB Studio game, not open
//     source — the repo path a user-supplied list cited (izma/deadeus)
//     doesn't exist (404).
//   - "Dangan GB" (snorpung.itch.io/dangan-gb): itch.io-only, no GitHub
//     repo — itch.io is blocked by this environment's egress proxy and
//     there's no source to build from.
//   - "Taiyaki" / "Fabulous Museum of Fish", "Swordbird Song": don't appear
//     anywhere in gbdev/awesome-gbdev (the canonical open-source GB games
//     list) or in a direct search — likely hallucinated citations from a
//     user-supplied list.
//   - DonaldHays/bubblefactory, brovador/GBsnake: real, but no LICENSE file
//     — default copyright applies, no redistribution right.
//   - rubfi/gbc-atari-boxing: no LICENSE file, and it's an explicit clone
//     of Activision's Atari 2600 Boxing — two independent reasons to skip.
//   - l0k1/superhappyfunbubbletime: GPL-2.0 (fine), but the author's own
//     README calls it pre-alpha and "not in a workable/playable condition,"
//     with no prebuilt ROM.
//   - rnegron/dino-gb (MIT): builds clean with GBDK-2020, no compile
//     errors — but the produced ROM renders a solid blank white screen in
//     WasmBoy (checked every pixel, not just a sparse sample, across
//     several button-press sequences). Same class of bug as 2048-gb: a
//     real emulation incompatibility, not a build or licensing issue.
//
// ── Round asked for genre matches: Mario, Pokemon, fighter jet, Contra, ────
// ── Street Fighter. itch.io is blocked by this environment's egress proxy,──
// ── which rules out every itch.io-only title outright (no source, no way ──
// ── to verify). Within what's actually GitHub-hosted with real source:   ──
//   - Mario-like platformer: nothing beats what's already above (Carazu,
//     Libbet, Pluto's Corner, Squishy the Turtle). Checked and rejected:
//     gingemonster/DinosOfflineAdventure, rnegron/dino-gb's sibling repo
//     (no LICENSE); Zal0/gbjam2016 "Super Princess 2092 Exodus" (no LICENSE,
//     and the title itself references Nintendo's Super Princess Peach);
//     lucasmg18/Game-Boy-Game (no LICENSE); elfgames/doctorhow (MIT, but a
//     tribute game built on the BBC's Doctor Who trademark — same category
//     of risk as evoland.gb above); MasterIV/PostBot (MIT, prebuilt ROM,
//     genuinely clean — but it's a robot-programming puzzle game despite
//     the name, not a platformer). aiguanachein/powa ("Powa!") looked like
//     a strong match in search results but is a PAID itch.io release with
//     no GitHub repo at all — the initial finding that it was open source
//     was a hallucinated citation, caught by checking the actual repo
//     rather than trusting the summary.
//   - Pokemon-like monster-collecting RPG: found nothing with a real,
//     redistributable license anywhere. The closest name match, "Poke Da
//     Mon" by Mike Kasprzak (retrobrews/gbc-games), is explicitly licensed
//     "for free distribution on this site/project only" — a direct refusal
//     of the right to redistribute it here, not merely a maybe.
//   - Fighter jet / scrolling shmup: speedlazer/speedlazer is a real,
//     clearly-licensed (MIT + CC BY-NC-SA) side-scrolling shooter, but it's
//     an HTML5/Crafty.js browser game, not a Game Boy ROM — wrong platform
//     entirely. Nothing GB-native and shmup-shaped surfaced with a license.
//   - Contra-like run-and-gun: kanfor/gunsridersgameboy (GPL-3.0, prebuilt
//     ROM, boots clean in WasmBoy — added above) is the closest real match
//     that exists, and it is a static shooting gallery, not a scrolling
//     run-and-gun. Labelled as what it actually is rather than as Contra.
//   - Street Fighter-like versus fighting game: nothing found anywhere —
//     not on GitHub, not in the awesome-gbdev list, not in retrobrews'
//     collection. Homebrew GB fighting games with real, redistributable
//     source do not appear to exist yet.
