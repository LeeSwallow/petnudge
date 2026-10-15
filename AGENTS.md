# AGENTS.md

What a coding agent needs before changing this repository. People: the
same is in [CONTRIBUTING.md](CONTRIBUTING.md), at more length.

## What this is

petnudge is an Electron app in TypeScript: a pixel pet in a transparent,
always-on-top window, with todos, pomodoro, notes and an MCP server. The
principles are in [VISION.md](VISION.md); the layout in
[docs/architecture.md](docs/architecture.md).

## Before you finish

```sh
npm run typecheck && npm test
```

Both must pass. The tests are the specification: change a test only when
the behaviour is meant to change, and say so. For a visible change, also run
`npm start` and look at the pet.

## Rules

- **Layers.** Dependencies point down: `ui`/`infra` → `app` → `core` →
  `domain`. `domain` uses no packages; `effect` is for `core` and `app`;
  Electron and `node:` modules only in `infra`. `src/architecture.test.ts`
  fails otherwise. `src/main`, `src/renderer`, `src/preload` and `src/shared`
  are older code being moved into these layers; new code goes in the layers.
- **New state changes go through the engine** (`src/core`): an action changes
  the database inside a transaction, events go out after commit, and handlers
  never wait on anything outside the process. The older code in `src/main`
  still calls the repository directly and the renderer still runs the timer;
  move a feature onto the engine before adding to it.
- **Characters and mods are data.** Edit the source art (`.aseprite`/`.pxo`)
  and the pack JSON, then export with `npm run build:character`; never edit
  `character.json` or `sheet.png` by hand.
- **User data.** Never run against the real profile for experiments or
  screenshots; set `PETNUDGE_PROFILE` to a temporary folder.
- **Dependencies** need a reason and a license compatible with MIT
  distribution; add it to THIRD_PARTY_NOTICES.md.
- **Commits** are Conventional Commits, one change each. Do not add
  `Co-Authored-By` or "Generated with" lines naming an AI tool.
- **Ask first** before pushing, merging into `main`, tagging, deleting
  branches, or anything that leaves this machine.
