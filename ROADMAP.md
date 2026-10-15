# Roadmap

**The goal: a pet you would keep on screen all day.** Useful enough that it
earns the space, quiet enough that you never turn it off. Every item below is
measured against that.

Ideas and open questions live in
[Discussions](https://github.com/LeeSwallow/petnudge/discussions).

## Now: v0.2.0, the first public build

Done when: anyone on macOS, Windows or Linux can install it from a release
and keep it running for a week.

- [x] Todos, pomodoro, dashboard, notes; local SQLite
- [x] Layered characters (Lila, Maru, Moa), outfits, colors, mods
- [x] MCP server for coding agents
- [x] Event-driven core engine and scheduler in the main process
- [ ] Todos, then the timer, moved onto the engine, so the timer keeps running in the main process
- [ ] Reminders: due dates, repeat rules, snooze (10, 30, 60 minutes, tomorrow morning), a summary of what was missed while asleep
- [ ] OS notifications that open the right panel; tray icon; start at login
- [ ] Installers from GitHub Actions on every `v*` tag: macOS dmg (arm64, x64), Windows exe, Linux AppImage
- [ ] The rename from the working title, keeping existing data
- [ ] Lila: a proper side walk cycle, like Maru and Moa

## Next: your coding agent

Done when: an agent that has never seen petnudge does the right thing with
the plugin alone, and the pet shows what the agent is doing.

- [x] MCP tools for todos, timer, notes, pet expressions
- [ ] A Claude Code and Codex plugin: skills, slash commands, and hooks so the
      pet reacts while the agent works (thinking, waiting for approval, failed, done)
- [ ] Listing in MCP directories and the Claude Code plugin marketplace

## Next: more pets

Done when: there are more characters made by other people than by me.

- [ ] Play [Petdex](https://petdex.dev) and Codex pets as flat pets: `pet.json` plus a sheet of 192×208 frames, 8×9 (nine animations) or 8×11 (Codex `spriteVersionNumber: 2`, with sixteen look directions)
- [ ] Export petnudge characters as Codex v2 pets (`pet.json` + 1536×2288 `spritesheet.webp`), ready to submit to Petdex
- [ ] A character template and a guide in English
- [ ] A gallery of community characters and mods

## Next: everyone can read it

- [ ] App interface in English and Japanese, alongside Korean
- [ ] Character guide and mod guide in English

## Not planned

Accounts, sync between machines, a mobile app, ads, or anything that sends
your data somewhere you did not choose.
