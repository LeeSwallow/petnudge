// Checks the panel in the real app: npm run check:ui (it builds first).
// Starts the built app with a throwaway profile (your data is never touched),
// clicks through the tabs with Chrome DevTools Protocol and checks what the
// screen shows. Fails on a wrong result, a console error or a CSP violation.
//
//   npm run check:ui                       every scenario
//   npm run check:ui -- todo notes         these, in this order
//   npm run check:ui -- --changed [base]   the ones covering what changed since
//                                          base (default: the merge-base with
//                                          origin/main, else HEAD~1), uncommitted
//                                          changes included
//
// The scenarios are scripts/ui-check/<name>.mjs; add a check to the one for
// the tab that gains behaviour. UI_CHECK_PORT runs checks side by side.
import { execFileSync } from 'node:child_process';
import { launch, runScenarios } from './ui-check/lib.mjs';
import { scenarios } from './ui-check/scenarios.mjs';
import { parseArgs, selectChanged, selectNamed } from './ui-check/select.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const tryGit = (...args) => {
  try {
    return git(...args);
  } catch {
    return null;
  }
};

const changedSince = (base) => {
  const resolved = base ?? tryGit('merge-base', 'HEAD', 'origin/main') ?? 'HEAD~1';
  const lines = (out) => (out ? out.split('\n').filter(Boolean) : []);
  // `git diff <base>` compares the working tree, so uncommitted edits count;
  // new files not yet added come from ls-files.
  const files = [...new Set([...lines(git('diff', '--name-only', resolved)), ...lines(git('ls-files', '--others', '--exclude-standard'))])];
  return { resolved, files };
};

const options = parseArgs(process.argv.slice(2));
let chosen;
if (options.changed) {
  const { resolved, files } = changedSince(options.base);
  const selection = selectChanged(scenarios, files);
  chosen = selection.scenarios;
  console.log(`changed since ${resolved.slice(0, 12)}: ${files.length} file(s)`);
  const { shared } = selection;
  if (shared.length) console.log(`  shared files changed, running all: ${shared.slice(0, 5).join(', ')}${shared.length > 5 ? ` and ${shared.length - 5} more` : ''}`);
  else if (selection.fallback) console.log('  no scenario covers them, running the panel');
  else for (const [name, hits] of selection.why) console.log(`  ${name}: ${hits.join(', ')}`);
} else if (options.names.length) {
  chosen = selectNamed(scenarios, options.names);
  console.log('running the named scenarios');
} else {
  chosen = scenarios;
  console.log('running every scenario');
}
console.log(`scenarios: ${chosen.map((s) => s.name).join(', ')}`);

const started = Date.now();
const session = await launch({ port: Number(process.env.UI_CHECK_PORT ?? 9343) });
let result;
try {
  result = await runScenarios(session, chosen);
} finally {
  session.close();
}
const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(result.failed ? `\n${result.failed} check(s) failed (${seconds}s)` : `\nall ${result.total} checks passed (${seconds}s)`);
process.exit(result.failed ? 1 : 0);
