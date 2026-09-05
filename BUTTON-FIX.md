# DIANO RACER — Button Fix

The previous package referenced `js/game.js` and `assets/models/diano_racer_trex.glb`,
but the GitHub repository upload shown in the screenshot placed `game.js` and
`diano_racer_trex.glb` in the repository root.

This package fixes both paths:
- `index.html` loads `game.js`
- `game.js` loads `diano_racer_trex.glb`

## Update GitHub

Replace the existing `index.html` and `game.js` with the files from this package.
Keep `diano_racer_trex.glb` in the repository root.

Then wait for GitHub Pages to redeploy and refresh the page.
