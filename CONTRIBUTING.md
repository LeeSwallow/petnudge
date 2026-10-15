# Contributing

Thanks for looking. petnudge has one maintainer and is before 1.0: how the
pet behaves still changes when I see it used. So the most useful thing is
often not code but a report of what you expected.

## Ways to help

| You have | Do this |
| --- | --- |
| a question, or an idea not yet thought through | start a [discussion](https://github.com/LeeSwallow/petnudge/discussions) |
| used it for a day and something felt wrong | a [design feedback](https://github.com/LeeSwallow/petnudge/issues/new?template=design_feedback.yml) issue |
| something broken | a [bug report](https://github.com/LeeSwallow/petnudge/issues/new?template=bug.yml) |
| something it should do | a [feature request](https://github.com/LeeSwallow/petnudge/issues/new?template=feature.yml) |
| a character or a mod you drew | a [character issue](https://github.com/LeeSwallow/petnudge/issues/new?template=character.yml) |
| time to build something | an issue labelled [accepted](https://github.com/LeeSwallow/petnudge/labels/accepted) or [good first issue](https://github.com/LeeSwallow/petnudge/labels/good%20first%20issue) |
| a language | a translation of the README or, soon, the app |
| a security problem | report it privately: [SECURITY.md](SECURITY.md) |

## From an issue to a release

Every issue starts as `needs triage`. The maintainer answers within a week:
`needs info` (a question for you), `accepted` (ready; anyone may take it) or
closed with a reason. Say in the issue that you are taking it; it becomes
`in progress`. A pull request is squashed onto `main`; a `v*` tag builds the
installers into a draft release.

## Setting up

```sh
git clone https://github.com/LeeSwallow/petnudge
cd petnudge
npm install
git config core.hooksPath .githooks   # removes AI co-author lines from commits
npm start
```

You need Node.js 22.16 or later. To try things without touching your own
data, run with another profile folder:

```sh
PETNUDGE_PROFILE=/tmp/petnudge-try npm start
```

## Making the change

- Read [AGENTS.md](AGENTS.md): the layer rules and the engine rules are
  the same for people.
- Write the test first when you change behaviour. `npm run typecheck && npm test`
  must pass.
- For a visible change, attach a screenshot. `npm run demo:shots` renders
  the README images from sample data.
- Characters: edit the source art and the pack JSON and export with
  `npm run build:character`; see [assets/characters/README.md](assets/characters/README.md).
- Words: the README exists in English, Korean and Japanese. Change the one
  you can; say in the pull request which ones need a translation.

## The pull request

- Title: a [Conventional Commit](https://www.conventionalcommits.org/)
  phrased for the release notes (`feat: snooze a reminder until tomorrow`).
- One kind label: feature, enhancement, bug, breaking change, docs,
  character or chore.
- `Closes #<issue>` in the description, unless it is a small fix.

## With an AI agent

Agents are welcome; [AGENTS.md](AGENTS.md) is written for them. You are the
author of what you submit: read the diff, run it, and say in the pull
request what you checked yourself. Commits do not list AI tools as
co-authors; the hook above and CI take those lines out.
