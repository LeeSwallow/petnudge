import { configDefaults, defineConfig } from 'vitest/config';

// Agent worktrees (.claude/worktrees) hold other branches' copies of the
// tests; they are not this checkout's suite.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, '.claude/**'] }
});
