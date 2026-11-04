import { describe, expect, it } from 'vitest';
import { SHARED, globToRegExp, parseArgs, selectChanged, selectNamed } from './select.mjs';
import { scenarios as real } from './scenarios.mjs';

const scenarios = [
  { name: 'panel', covers: ['src/ui/panel-extra/**'] },
  { name: 'todo', covers: ['src/ui/modules/todo/**', 'src/renderer/filterBar.ts'] },
  { name: 'notes', covers: ['src/ui/modules/notes/**'] },
  { name: 'dashboard', covers: ['src/ui/modules/dashboard/**', 'src/renderer/filterBar.ts'] }
];
const names = (selection) => selection.scenarios.map((s) => s.name);

describe('globToRegExp', () => {
  it('lets ** cross folders and * stay inside one', () => {
    expect(globToRegExp('src/ui/modules/notes/**').test('src/ui/modules/notes/Notes.svelte')).toBe(true);
    expect(globToRegExp('src/ui/modules/notes/**').test('src/ui/modules/notes/deep/a.ts')).toBe(true);
    expect(globToRegExp('src/ui/modules/notes/**').test('src/ui/modules/notesx/a.ts')).toBe(false);
    expect(globToRegExp('src/main/chat*.ts').test('src/main/chatIpc.ts')).toBe(true);
    expect(globToRegExp('src/main/chat*.ts').test('src/main/chat/x.ts')).toBe(false);
    expect(globToRegExp('build.mjs').test('scripts/build.mjs')).toBe(false);
  });
});

describe('selectChanged', () => {
  it('runs the scenarios whose files changed, in their own order', () => {
    const s = selectChanged(scenarios, ['src/ui/modules/notes/Notes.svelte', 'src/ui/modules/todo/logic.ts']);
    expect(names(s)).toEqual(['todo', 'notes']);
    expect(s.why.get('notes')).toEqual(['src/ui/modules/notes/Notes.svelte']);
  });

  it('runs every scenario that covers a file', () => {
    expect(names(selectChanged(scenarios, ['src/renderer/filterBar.ts']))).toEqual(['todo', 'dashboard']);
  });

  it('runs all when a shared file changed', () => {
    const s = selectChanged(scenarios, ['src/ui/modules/notes/a.ts', 'src/ui/panel/Panel.svelte']);
    expect(names(s)).toEqual(['panel', 'todo', 'notes', 'dashboard']);
    expect(s.shared).toEqual(['src/ui/panel/Panel.svelte']);
  });

  it('treats the listed shared paths as shared', () => {
    for (const file of ['src/ui/state/bridge.ts', 'src/renderer/renderer.ts', 'src/renderer/index.html', 'src/renderer/styles.css', 'src/preload/preload.ts', 'src/main/main.ts', 'scripts/ui-check/lib.mjs', 'build.mjs', 'package.json'])
      expect(selectChanged(scenarios, [file]).shared, file).toEqual([file]);
    expect(SHARED.length).toBeGreaterThan(0);
  });

  it('runs the panel alone when nothing matches', () => {
    const s = selectChanged(scenarios, ['src/domain/todo.ts', 'README.md']);
    expect(names(s)).toEqual(['panel']);
    expect(s.fallback).toBe(true);
    expect(names(selectChanged(scenarios, []))).toEqual(['panel']);
  });

  it('does not run a scenario twice', () => {
    expect(names(selectChanged(scenarios, ['src/ui/modules/notes/a.ts', 'src/ui/modules/notes/b.ts']))).toEqual(['notes']);
  });
});

describe('selectNamed', () => {
  it('keeps the order given', () => {
    expect(selectNamed(scenarios, ['notes', 'todo']).map((s) => s.name)).toEqual(['notes', 'todo']);
  });
  it('refuses an unknown name and lists the known ones', () => {
    expect(() => selectNamed(scenarios, ['nope'])).toThrow(/nope.*panel, todo, notes, dashboard/);
  });
});

describe('parseArgs', () => {
  it('reads names, --changed and its base', () => {
    expect(parseArgs([])).toEqual({ names: [], changed: false, base: null });
    expect(parseArgs(['todo', 'notes'])).toEqual({ names: ['todo', 'notes'], changed: false, base: null });
    expect(parseArgs(['--changed'])).toEqual({ names: [], changed: true, base: null });
    expect(parseArgs(['--changed', 'main'])).toEqual({ names: [], changed: true, base: 'main' });
  });
  it('refuses names together with --changed', () => {
    expect(() => parseArgs(['--changed', 'main', 'todo'])).toThrow();
    expect(() => parseArgs(['--what'])).toThrow();
  });
});

describe('the scenarios', () => {
  it('have unique names, covers and checks', () => {
    const all = real.map((s) => s.name);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toContain('panel');
    for (const s of real) {
      expect(s.covers.length, s.name).toBeGreaterThan(0);
      expect(s.checks.length, s.name).toBeGreaterThan(0);
    }
  });
  it('keep at least the 87 checks the single script had', () => {
    expect(real.reduce((n, s) => n + s.checks.length, 0)).toBeGreaterThanOrEqual(87);
  });
  it('map a notes change to the notes scenario only', () => {
    expect(names(selectChanged(real, ['src/ui/modules/notes/Notes.svelte']))).toEqual(['notes']);
  });
});
