# DIANO RACER — Asset Replacement Guide

## Dinosaur
Recommended production format: `.glb`

Target:
- 20k–60k triangles for the main mobile character
- 1–2 material sets
- 1024 or 2048 PBR textures
- skeletal rig
- animation clips

## Environment
Use low-poly, PBR-ready assets.

Suggested budgets:
- Tree: 500–3000 triangles
- Rock: 200–1200 triangles
- Small plant: 100–700 triangles
- Major obstacle: 300–2500 triangles

## Textures
Prefer:
- WebP/AVIF where supported
- 1024px textures for repeated props
- 2048px only for the hero character if required

Avoid many unique 4K textures because mobile memory usage can rise quickly.

## Animation naming
Use exact names where possible:

`Idle`
`Run`
`Jump`
`Slide`
`TurnLeft`
`TurnRight`
`Hit`

## GLB export
When exporting from Blender:
- Apply transforms
- Use glTF 2.0
- Include animation
- Keep materials simple
- Remove hidden geometry
- Apply sensible origin/pivot
- Test at mobile scale
