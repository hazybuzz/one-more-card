# Battle Art Slots

Battle art is optional. Missing assets fall back to the current procedural UI.

## Theme Layers

Recommended paths:

```text
themes/<theme-id>/background.png
themes/<theme-id>/table.png
themes/<theme-id>/foreground.png
```

- Canvas: 1280 x 720.
- `background.png`: opaque room or environment.
- `table.png`: transparent table and midground details.
- `foreground.png`: transparent atmosphere below the gameplay UI.
- Keep important detail away from cards, HP, buttons, and score badges.

## Character Sheets

Recommended paths:

```text
characters/player/<character-id>/all.png
characters/enemies/<enemy-id>/all.png
```

- Transparent PNG.
- Four equal horizontal frames.
- Frame order: idle, cast/passive, attack, hurt.
- Pixel art should be exported at its native resolution and scaled with nearest-neighbor filtering.

## UI Skins

Recommended paths:

```text
common/player-panel.png
common/enemy-panel.png
common/action-bar.png
```

- Transparent PNG with a stretchable center.
- Keep borders and corners inside fixed NineSlice margins.
- Register completed assets in `src/ui/art/BattleArtRegistry.ts`.
