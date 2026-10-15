# Layered Character (Lila) — Design

Date: 2026-10-15
Scope: `apps/desktop` desktop pet character art pipeline + renderer

## Goal

Replace the single-sprite "miso" pet with **Lila (리라)** (from the user's concept sheet; renamed so the character is not confused with the HeyLila service), drawn as a
moderately deformed chibi at 96×112, with:

1. Natural idle motion (breathing, blink, ribbon sway) that never "boils".
2. Outfits that can be swapped per slot (top / outer / bottom / legwear / headwear),
   not baked into the sprite.
3. A data-driven animation format so adding a state or an outfit is an asset change,
   not a code change.
4. A pipeline the user can edit by hand in Aseprite.

## Findings that shaped this

- AI animation (`animate_image`) redraws the whole sprite every frame: 800–2,000 of
  ~3,400 opaque pixels change per frame → visible jitter. It also cannot produce
  separable clothing layers.
- A deterministic rig on a clean base (integer offsets per region) gives a smooth idle
  with zero jitter and zero generation cost (`scratchpad/pixellab/rig_lila.py`).
- Aseprite 1.3.18 CLI works headless: a Lua script can build a layered, tagged
  `.aseprite`, and `--split-layers --list-tags --format json-array` exports it.

## Source of truth: `lila.aseprite`

`apps/desktop/assets/characters/lila/lila.aseprite`, canvas 96×112, one palette.

Layer stack (back → front). A group = slot; a layer inside = variant.

| Order | Layer / group | Notes |
|---|---|---|
| 1 | `hair_back` | behind body |
| 2 | `body` | skin, base face (no eyes/mouth), plain inner wear |
| 3 | `legwear/<variant>` | socks + shoes |
| 4 | `bottom/<variant>` | shorts, skirt |
| 5 | `top/<variant>` | t-shirt, hoodie |
| 6 | `outer/<variant>` | jacket, cardigan (`none` = no layer drawn) |
| 7 | `hair_front` | bangs, sides |
| 8 | `headwear/<variant>` | cat-ear headphones, none |
| 9 | `face/<expression>` | `open`, `blink`, `closed`, `smile`, `focused`, `surprised` |
| 10 | `fx/<name>` | headphone glow, blush pulse |

Tags = states: `idle`, `focus`, `sip`, `windowGaze`, `sleep`, `dragged`, `celebrate`,
`heart`. Each state is a short set of **key poses** (1–3 frames). Motion between them
comes from the rig, not from extra drawings.

## Runtime format: `study-pet-character@2`

Built by `scripts/build-character.mjs lila` (Aseprite CLI → files below).

- `sheet.png` — every (layer, pose) cell packed in a grid.
- `character.json`:

```jsonc
{
  "format": "study-pet-character@2",
  "frame": { "w": 96, "h": 112 },
  "layers": ["hair_back", "body", "legwear", "bottom", "top", "outer",
             "hair_front", "headwear", "face", "fx"],
  "cells": { "body:stand": 0, "outer/jacket:stand": 7, "face/blink": 21 },
  "regions": {                       // rig groups, in frame pixels
    "upper": { "rows": [0, 52] },
    "head":  { "rows": [0, 42] },
    "ribbons": { "rows": [68, 94], "cols": [[0, 33], [59, 96]] }
  },
  "states": {
    "idle": {
      "pose": "stand",
      "loop": [
        { "ms": 700 },
        { "ms": 350, "move": { "upper": [0, -1] } },
        { "ms": 500, "move": { "upper": [0, -1], "ribbons": [1, 0] } },
        { "ms": 350, "move": { "upper": [0, -1] } },
        { "ms": 600 },
        { "ms": 450, "move": { "ribbons": [-1, 0] } }
      ],
      "blink": { "everyMs": [2600, 5200], "ms": 120 }
    },
    "sleep": {
      "pose": "stand", "face": "closed",
      "loop": [ { "ms": 900, "move": { "head": [0, 1] } }, { "ms": 900, "move": { "head": [0, 2] } } ]
    }
  },
  "slots": {
    "outer": { "label": "아우터", "variants": { "jacket": {}, "cardigan": { "unlock": "outfit-knit-cardigan" }, "none": {} } },
    "hair":  { "label": "머리색", "variants": { "lavender": {}, "pink": { "recolor": { "#dac9e7": "#f6c6e0" } } } }
  }
}
```

Rules:
- A frame inherits `pose` and `face` from its state; it may override either.
- `move` shifts a region by whole pixels. Layers inside the region move with it,
  so every outfit follows the motion for free.
- A missing `layer:pose` cell falls back to `layer:stand`; a missing variant draws
  nothing.
- Blink is scheduled by the renderer (random interval in `everyMs`), drawn by swapping
  `face` to `blink`, and is skipped when the state sets `face`.
- Recolor stays exact-hex per slot (as in v1), applied per layer.

## Renderer (`src/renderer/character.ts`)

Public API unchanged: `drawCharacter(ctx, x, y, scale, { state, turn, avatar, … }, now)`.
Internals split into pure, tested modules:

- `characterPack.ts` — types + loader for `@2` (validation, fallbacks).
- `timeline.ts` — `(state, elapsedMs) → { pose, face, moves }` (pure).
- `compose.ts` — layer order + avatar → list of `{ cell, dx, dy, region }` draws (pure).
- `character.ts` — canvas: recolor cache, region-clipped blits.

`avatar` grows from `{ hair, outfit, headwear, led }` to one key per slot. Settings
migration maps old `outfit` ids to the new slots.

Head turn (`turn`): v2 starts with `turn` ignored (front only); left/right head
cells can be added later as `hair_front`/`face`/`headwear` poses `turnL`/`turnR`.

## Asset production

1. **Base pieces** (done for `stand`): AI base (`create_image_pro_flash`) → palette lock
   + despeckle (`clean_lila.py`) → split into layers in Aseprite.
2. **Splitting layers**: generate the same pose with outfit removed / swapped
   (`edit_image_pro_flash`), diff against the full sprite to get each clothing layer,
   then hand-clean in Aseprite.
3. **Key poses** (sip, focus, celebrate, heart, dragged): one AI key pose per state,
   split the same way. Motion comes from the rig.
4. **New outfit**: per pose, `transfer_outfit`/`edit_image` on the body → diff →
   new layer in the outfit group. Cost scales with poses × outfits, which is why poses
   are kept few.

## Aseprite workflow for the user

- Open `lila.aseprite`. The Layers panel shows each slot as a group.
- To fix pixels: click a layer, press `B` (pencil), pick a palette colour, draw. `E` is
  the eraser, `Ctrl/Cmd+Z` undoes. Hide other layers with the eye icon to isolate one.
- Tags along the timeline are the states; click a tag to play it (`Enter`).
- Save, then run `npm run build:character` in `apps/desktop`. The pet reloads with the
  new art.

## Testing

- vitest: `timeline` (looping, per-frame overrides, blink scheduling with injected
  clock), `compose` (layer order, missing variant/pose fallback, `none` slot),
  pack validation (unknown layer, cell out of range).
- Build script: exits non-zero when a tag references a missing pose layer or the canvas
  is not 96×112.
- Manual: `npm start`, check every state and every outfit at scale 2.

## Out of scope

- Mobile app (Skia) renderer — it can consume the same `@2` pack later.
- 8-direction / walking.
- Paid PixelLab tiers; v2 ships with what the trial credits allow (1 outfit set +
  `stand` + up to 2 key poses). More outfits/poses follow a subscription.

## Open questions

- Whether `miso` stays as a selectable second character or is removed.

## Implementation (2026-10-15) — what was built, and where it differs

**Layers shipped** (flat names in `lila.aseprite`, no groups): `body`,
`outer.jacket`, `outer.cardigan`, `headwear.catphones`, `face.closed`, `face.smile`,
`face.focused`, `face.surprised`. Top/bottom/legwear/hair stay inside `body` for now
(only the outer and headwear slots are removable); hair colour is a recolor limited to
the `hair` region of the `body` layer, because the hair hexes also appear in the shirt.

**Pack format as built** (`src/renderer/character/pack.ts`):
- `layers: [{ id, from? }]` — `from: "slot"` draws `<id>.<variant>`, `from: "face"`
  draws `face.<expression>` (`open` = the body's own face), otherwise cell `<id>`.
- `regions: { name: [[x0, y0, x1, y1], …] }` boxes; `move` shifts a region by whole
  pixels, uncovered pixels repeat the box edge, pixels pushed out land on what's there.
- `cells: { name: [x, y] }` sheet positions, written by the build from Aseprite's JSON.
- Recolor: `{ layers?, region?, map }` per variant.
- Head turn is replaced by the `eyes` region following the cursor (`look: true`).

**Art pipeline that held up**: AI base → AI edits of the same pose (jacket removed,
headphones removed, cardigan) → layer = pixels that differ, pruned → AI edits for each
expression, cut to the eyes/mouth box. Hand-drawn faces and aggressive palette
reduction were tried and rejected: they broke the AI art's style.

**Display**: `pixelSize()` counts device pixels, so every art pixel is a whole number
of screen pixels on Retina (size 2 = 3 device px = 1.5× CSS).

**Window layout** (`src/main/layout.ts`, added in the same change): the pet's feet
are the saved anchor (`pet.anchor`, migrated from `window.position`). The window is
only as tall as the pet area while the panel is closed — so macOS no longer stops the
pet below the menu bar — and grows above the pet, or below when there is no room
above, shrinking the panel when neither side fits. At screen edges the window stays on
screen and the pet is shifted inside it.

**Build**: `npm run build:character` (Aseprite CLI; `ASEPRITE=` to override the path).
`node scripts/build-character.mjs lila --import <dir>` recreates the `.aseprite` from
PNG layers (overwrites hand edits).

**Old `miso` pack** is left in `assets/characters/miso` but no longer loaded.

### Behaviours added later the same day

All are pack data in `lila.pack.json`; the renderer only interprets them.

- **Cell variants**: `<cell>@turnL|turnR` (turned head) and `<cell>#<pose>` (body pose,
  e.g. `#stretch`) replace the plain cell when present. Layers without a variant keep
  the front art (outfits stay put under a turned head).
- **Cursor follow** (`look: true` states): a small offset glances (eyes region moves),
  a large one turns the head — only when the current face also exists for the turned
  head, otherwise it glances. Hysteresis in `pet.ts` stops flicker at the thresholds.
- **Fidgets**: `fidgets: { states, everyMs }` — while idle, one of `lookAround`,
  `yawn`, `hum`, `stretch` plays once every 9–22 s.
- **Talking**: while a bubble line types, the face cycles `talkA → talkB → talkA → open`
  (`talkFace`), only over an open face.
- **Actions** (`src/renderer/character/actions.ts`): `hitAreas` (head/chest/belly boxes)
  + `actions` (label, area, tap, menu, state, ms, fx, lines). Left-click on the head pats
  (the panel still toggles); right-click on an area plays its action; right-click
  elsewhere opens the menu (pat, chest poke, belly poke, flick, tickle). Effects:
  hearts, stars, anger mark, sweat, sparkles. The chest poke is a comedic "hey!" pout.
- **Aseprite helpers** (`scripts/aseprite/`): `add-layers.lua` (add/replace layers in
  place), `recolor.lua` (exact colour swaps), `dither.lua` (1px checker on tone edges).
