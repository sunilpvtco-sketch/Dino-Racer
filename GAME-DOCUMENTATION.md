# DIANO RACER — Game Documentation

## Game concept
DIANO RACER is a mobile-first 3D endless jungle runner.

The dinosaur runs forward automatically. The player changes between three muddy-road lanes, jumps over obstacles, slides under gates and collects coins/power-ups.

## Controls

### Mobile
- Swipe left → move one lane left
- Swipe right → move one lane right
- Swipe up → jump
- Swipe down → slide

### Desktop
- Left / Right arrows → lane change
- Up arrow / Space → jump
- Down arrow → slide

## Power-ups

### Magnet
Pulls nearby coins toward the dinosaur.

### Speed Boost
Temporarily increases running speed.

### Shield
Absorbs one collision.

### Extra Life
Adds one life.

## Obstacles

- Logs
- Rocks
- Spikes
- Jungle gates

## Scoring
Coins add score and distance contributes to continuous score.

The best score is stored in browser `localStorage`.

## Technical stack

- HTML5
- CSS3
- Vanilla JavaScript
- Three.js
- GLTFLoader
- WebGL
- PWA manifest
- Service Worker
- Browser localStorage

## Performance
The renderer caps device pixel ratio to reduce GPU load on mobile devices.

For future production builds:
- Compress GLB geometry
- Use Draco/Meshopt where appropriate
- Resize textures
- Use texture atlases
- Add object pooling
- Reduce shadow-map resolution on low-end devices
- Add quality presets

## 3D character
The included T-Rex is a generated GLB with named meshes and PBR materials.

The current GLB is a static character mesh. For professional animation, rig it in Blender and export:

- Idle
- Run
- Jump
- Slide
- TurnLeft
- TurnRight
- Hit

Then load the animation clips with Three.js `AnimationMixer`.

## Replacing the dinosaur
Replace:

`assets/models/diano_racer_trex.glb`

Keep the same filename, or update the path in:

`js/game.js`

The replacement should face forward along the positive X axis used by the asset pipeline or be rotated appropriately during loading.

## Replacing jungle assets
Additional GLB assets can be added under:

`assets/models/`

Recommended environment assets:
- palm trees
- broadleaf trees
- vines
- rocks
- fallen logs
- ferns
- mud decals
- distant mountains
- fog cards

## Audio
Add compressed `.ogg` or `.mp3` files under:

`assets/audio/`

Recommended:
- jungle ambience
- footsteps
- jump
- coin
- power-up
- collision
- game over

## Data
No account or server database is used. Local score data is browser-local.

## License / ownership
All custom source files in this package were created for the DIANO RACER project. Third-party libraries such as Three.js remain under their respective licenses and are loaded from the jsDelivr CDN in this build.
