# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the release notes
on GitHub are built from pull request labels.

## [Unreleased]

### Added

- An event-driven core engine in the main process: serial actions, events
  after commit, and a scheduler that sleeps until the next job and wakes on
  resume and unlock.
- Layer rules enforced by a test (`src/architecture.test.ts`).
- `PETNUDGE_PROFILE` runs the app against another data folder;
  `npm run demo:shots` renders the README images from sample data.
- Linux AppImage build target.
- The installers carry the license text of every bundled package
  (`licenses/`), the project license and THIRD_PARTY_NOTICES.md.

### Changed

- The project is now **petnudge**. The repository root is the desktop app;
  the mobile prototype and planning documents were removed.
- The MCP server and the copied client config are named `petnudge`.
- Music sync (pausing and resuming Spotify or Apple Music with the timer) is
  off for new profiles; a setting you saved before is kept.
- The commit hook matches AI tools by e-mail address, so people named
  Claude, Devin or Jules keep their co-author credit.

### Removed

- The unused `@anthropic-ai/claude-agent-sdk` dependency.

## [0.1.0] - 2026-10-15

The working version under the title "Study Companion Pet": a transparent,
always-on-top pixel pet with todos, pomodoro, dashboard, notes, optional
music and chat, layered characters with outfits, mods, and an MCP server.
