# Art credits

All third-party art in this folder and in `../textures` is free to use in this game.

## Dinosaurs — Quaternius, public domain (CC0)
- `velociraptor.json` — Velociraptor from the "Animated Dinosaurs" pack, https://quaternius.com/packs/animateddinosaurs.html
  (smoothing/PBR tweaks by Michalis Kamburelis for the Castle Game Engine examples)
- `trex.json`, `triceratops.json`, `raptor.json` — same pack, via the CC0 collection in the
  `@netforge/asset-library-files` npm package (its NOTICE file records each source page).

## Props — Quaternius and Kenney (Nature Kit), public domain (CC0)
- `rock_large`, `rock_tall`, `stump`, `log`, `flower_red`, `mushroom_red`, `bush_large`,
  `crystal_rock`, `column`, `column_broken` (`.json`), via `@netforge/asset-library-files`.

## Trees — generated with ez-tree (MIT), https://github.com/dgreenheck/ez-tree
- `trees/*.json` were generated from ez-tree's oak, ash, aspen, pine and bush presets and simplified for phones.
- Bark photos (`../textures/bark_*`): Poly Haven (bark_brown_02, CC0) and TextureCan (CC0), as listed by ez-tree.
- Leaf textures (`../textures/leaves_*`): from the ez-tree package (MIT).

All models were converted to self-contained glTF `.json` files (uncompressed) so the game and its web preview can load them.

## Diano (realistic reptile) — supplied by the project owner
- `reptile.json` — textured reptile mesh provided by the project owner (source/licence to be recorded here).
  It came without a skeleton; it was auto-rigged for this game (31 bones), straightened from its
  original S-curved pose, and given procedural Run, Walk, Idle, Jump, Attack and Death animations.
