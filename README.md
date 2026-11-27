# Diano Racer

A mobile-first 3D endless jungle runner built with Three.js. Run as Diano through five areas
(Jungle Path, Waterfall, Ancient Ruins, Wooden Bridge, Cave) plus a Night Mode.

## Play locally
```
cd www && python3 -m http.server 8000
```
Then open http://localhost:8000.

## Controls
- Touch: swipe left/right to change lane, up to jump, down to slide
- Keyboard: arrows / WASD, Space to jump, P or Esc to pause
- Gamepad: D-pad or left stick, A jump, B slide, Start pause

## Features
- Procedurally modelled and animated raptor (run, jump, slide, idle, crash) with 3 skins
- Five themed zones with their own road surface, props, gateways and lighting
- 13 obstacle types, coins, Magnet, Speed Boost, Shield, Extra Life and Golden Eggs
- Menus from the UI sheet: splash, main menu, character select, journey select,
  how to play, high scores, settings, pause and game over
- Synthesised music and sound effects, vibration, HD/Fast graphics setting
- Works offline (service worker)

## Progression
- **Villain T-Rex** chases you: every crash or stumble brings it closer (danger meter at the top).
  If it reaches you the run ends. Shake it off to score an escape.
- **Shop**: permanent upgrades (Extra Life, Protection, Speed Up, Magnet) and one-run boosters.
- **Unlocks**: buy new dinos (Rusty, Frost) and new starting roads with coins.
- **Awards**: 16 achievements with coin rewards and three rotating goals that get harder.

## Layout
- `www/index.html` — UI and styles
- `www/game.js` — the game
- `www/vendor/three.min.js` — Three.js r149
