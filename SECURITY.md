# Security

## What petnudge promises

- The MCP server listens on `127.0.0.1` only, checks the Host and Origin
  headers, and answers only requests that carry the token shown in Settings.
- Your data stays in a local SQLite file under your user folder. Nothing is
  sent anywhere unless you use chat. Chat goes through the provider you pick
  (your Claude Code or Codex login, an API key, or a local model) and sends
  it your messages, the pet's context (nickname, timer, todo count, the song
  playing) and the results of the tools you allow, such as your todos or
  notes. Settings → AI chat chooses which tools it may use.
- Characters and mods are data (JSON and images). Loading one never runs code.
- The renderer has no general file access; playlist files are streamed by id.

A way around any of these is a security problem.

## Reporting one

Report it privately: on GitHub, **Security → Report a vulnerability**
([new advisory](https://github.com/LeeSwallow/petnudge/security/advisories/new)),
or email the address on the maintainer's GitHub profile. Do not open a
public issue.

You will hear back within a week. A fix goes into the next release, and the
advisory is published with it, crediting you unless you would rather not.
Fixes are best effort; there is no bounty.

## Supported versions

Only the latest release. petnudge is before 1.0, so a fix is not backported.
