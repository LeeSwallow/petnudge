# Mods: block-based behaviour scripts

Goal: anyone can add or change what the pet does (when she reacts, what she plays and says) without code, and many mods can live side by side. The format is JSON made of **blocks** so it can be edited as text now and with a visual block editor later; every block is one object with a `block` type.

## Where mods live

- Built-in: `apps/desktop/assets/mods/<id>/mod.json` (shipped with the app).
- User: `<userData>/mods/<id>/mod.json` (created from the app, edited in any text editor).
- The app watches the user folder and reloads on save. Each mod can be turned on or off in Settings → 모드 (stored in the `mods.disabled` kv list).
- Imported mods never execute code: only the blocks below exist.

## mod.json

```json
{
  "format": "study-pet-mod@1",
  "id": "cozy",
  "name": "포근한 반응",
  "description": "쓰다듬으면 더 좋아해요",
  "characters": ["*"],
  "states": { "spin": { "loop": [{ "ms": 120, "head": "turnL" }, { "ms": 120 }, { "ms": 120, "head": "turnR" }] } },
  "behaviors": [
    {
      "id": "pat-more",
      "name": "머리 쓰다듬기",
      "when": { "block": "tap", "area": "head" },
      "if": [{ "block": "chance", "p": 0.6 }],
      "cooldownMs": 2000,
      "do": [
        { "block": "play", "state": "patted", "ms": 1200, "fx": "hearts" },
        { "block": "say", "lines": ["헤헤…", "더 해줘!"] },
        { "block": "random", "branches": [[{ "block": "play", "state": "spin", "ms": 800 }], []] }
      ]
    }
  ]
}
```

- `characters`: ids the mod applies to, `"*"` for all.
- `states`: extra animations (same shape as pack states: frames with `ms`, `move`, `face`, `head`, `pose`, `dx`, `dy`). They are added to the active character's states; a mod state may override a pack state of the same name.
- `behaviors`: each has one `when` trigger, optional `if` conditions (all must hold), optional `cooldownMs` and `priority` (higher runs first when several match), and a `do` list of steps run in order.

## Blocks

**when** (triggers)

| block | fields | fires |
| --- | --- | --- |
| `tap` | `area?` | left-click on a body part (or anywhere) |
| `menu` | `label` | adds an item to the right-click menu |
| `random` | `everyMs: [min, max]` | every random interval while idle |
| `idle` | `afterMs` | once after this long without activity |
| `timer` | `event`: `focusStart` `focusEnd` `breakStart` `breakEnd` | pomodoro transitions |
| `music` | `playing` | music starts (`true`) or stops (`false`) |
| `drag` | `phase`: `start` `end` | picked up / put down |
| `time` | `hour` | once when the clock reaches that hour |

**if** (conditions): `chance {p}`, `timer {mode: idle|focus|break}`, `hours {from, to}`, `music {playing}`, `character {ids}`, `walking {value}`, `not {if}`.

**do** (steps): `play {state, ms, fx?, line?}`, `say {lines}`, `fx {kind, ms}`, `face {face, ms}`, `wait {ms}`, `walk {dx, dy}`, `action {id}` (a pack action), `random {branches}`, `repeat {times, do}`, `stop` (end this behaviour).

A running behaviour is interrupted by a drag, by opening the panel, or by another behaviour with higher priority.

## How it runs

- Main: `mods:list` reads and validates both folders (zod), `mods:create` copies a template into the user folder, `mods:open` reveals a mod, a watcher sends `mods:changed`.
- Renderer: `character/mods.ts` (pure) validates, merges states into the pack, matches triggers and conditions, and runs steps through injected primitives (play, say, fx, walk, wait…), so it is testable without the DOM. `pet/mods.ts` wires it to input, timer, music and the frame loop.
- Pack touch actions and emotes keep working; a matching mod `tap` behaviour takes precedence over the pack's tap action.

## Also in this round

- **New character by cloning**: Settings → "이 캐릭터로 새로 만들기" copies the active character's source and pack into the user folder under a new id and name, builds it, selects it and opens the editor.
- **In-app auto rebuild**: after "원본 편집", the app watches that source and rebuilds on save; errors show in Settings. No terminal needed.
