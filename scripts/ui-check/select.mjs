// Which UI check scenarios to run: by name, or by the files that changed.
// Pure (no git, no files), so select.test.mjs pins it down.

// A change here can break any tab, so it runs every scenario.
export const SHARED = [
  'src/ui/panel/**',
  'src/ui/state/**',
  'src/ui/components/**',
  'src/ui/theme/**',
  'src/ui/modules/registry.ts',
  'src/ui/modules/module.ts',
  'src/renderer/renderer.ts',
  'src/renderer/index.html',
  'src/renderer/styles.css',
  'src/renderer/store.ts',
  'src/renderer/api.ts',
  'src/preload/**',
  'src/main/main.ts',
  'src/main/db/**',
  'src/shared/dbMethods.ts',
  'scripts/ui-check/lib.mjs',
  'scripts/ui-check.mjs',
  'build.mjs',
  'package.json'
];

// `**` matches across folders, `*` within one name.
export const globToRegExp = (glob) => {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      i++;
      if (glob[i + 1] === '/') i++; // `a/**/b` also matches `a/b`
      source += '.*';
    } else if (c === '*') source += '[^/]*';
    else if (c === '?') source += '[^/]';
    else source += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
};

const matcher = (globs) => {
  const res = globs.map(globToRegExp);
  return (file) => res.some((re) => re.test(file));
};

// Every scenario whose `covers` match a changed file; all of them when a
// shared file changed; the panel alone when nothing matched.
export const selectChanged = (scenarios, changed, { shared = SHARED, fallback = 'panel' } = {}) => {
  const isShared = matcher(shared);
  const sharedHits = changed.filter(isShared);
  if (sharedHits.length) return { scenarios: [...scenarios], why: new Map(), shared: sharedHits, fallback: false };
  const why = new Map();
  for (const scenario of scenarios) {
    const hits = changed.filter(matcher(scenario.covers));
    if (hits.length) why.set(scenario.name, hits);
  }
  if (!why.size) return { scenarios: scenarios.filter((s) => s.name === fallback), why, shared: [], fallback: true };
  return { scenarios: scenarios.filter((s) => why.has(s.name)), why, shared: [], fallback: false };
};

export const selectNamed = (scenarios, names) =>
  names.map((name) => {
    const found = scenarios.find((s) => s.name === name);
    if (!found) throw new Error(`no UI check scenario "${name}"; there are: ${scenarios.map((s) => s.name).join(', ')}`);
    return found;
  });

// npm run check:ui [-- name...] | [-- --changed [base]]
export const parseArgs = (argv) => {
  const args = [...argv];
  if (args[0] === '--changed') {
    if (args.length > 2) throw new Error('--changed takes at most one base (a git ref), not scenario names');
    if (args[1]?.startsWith('-')) throw new Error(`unknown option ${args[1]}`);
    return { names: [], changed: true, base: args[1] ?? null };
  }
  const option = args.find((a) => a.startsWith('-'));
  if (option) throw new Error(`unknown option ${option} (use scenario names, or --changed [base] first)`);
  return { names: args, changed: false, base: null };
};
