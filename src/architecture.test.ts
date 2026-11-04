import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Layer rules from docs/superpowers/specs/2026-10-15-study-companion-architecture-design.md §1.
// Dependencies point down: ui/infra → app → core → domain. Legacy folders
// (main, renderer, preload, shared) are unchecked until stage 3 empties them.
// `i18n` (the message catalogs and their runtime, #77) sits under every
// layer: anything may read the wording, and it reads nothing but itself.
const LAYERS = ['i18n', 'domain', 'core', 'app', 'infra', 'ui'] as const;
type Layer = (typeof LAYERS)[number];
const LEGACY = ['main', 'renderer', 'preload', 'shared'];

const mayImport: Record<Layer, readonly string[]> = {
  i18n: ['i18n'],
  domain: ['domain', 'i18n'],
  core: ['core', 'domain', 'i18n'],
  app: ['app', 'core', 'domain', 'i18n'],
  infra: ['infra', 'core', 'domain', 'i18n', ...LEGACY],
  ui: ['ui', 'domain', 'i18n', ...LEGACY]
};

interface ImportRef {
  readonly spec: string;
  readonly typeOnly: boolean;
}

const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g;
// `typeof import('x')` is a type position, not a runtime import.
const DYNAMIC = /(?<!typeof )import\(\s*['"]([^'"]+)['"]\s*\)/g;

export const importsOf = (source: string): ImportRef[] => [
  ...[...source.matchAll(IMPORT)].map((m) => ({ spec: m[2], typeOnly: Boolean(m[1]) })),
  ...[...source.matchAll(DYNAMIC)].map((m) => ({ spec: m[1], typeOnly: false }))
];

const layerOf = (file: string): string => file.split('/')[0];

// `file` and the result are paths relative to src/, with forward slashes.
// A Svelte component imports only from its <script> blocks; the markup is text.
const scriptsOf = (source: string) => [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');

export const violations = (file: string, source: string): string[] => {
  const layer = layerOf(file) as Layer;
  if (!LAYERS.includes(layer)) return [];
  const found: string[] = [];
  const code = file.endsWith('.svelte') ? scriptsOf(source) : source;
  for (const { spec, typeOnly } of importsOf(code)) {
    if (spec.startsWith('.')) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
      const targetLayer = layerOf(target);
      if (!mayImport[layer].includes(targetLayer)) found.push(`${file} → ${target}`);
      // app modules talk through events only: app/todos must not import app/notes.
      else if (layer === 'app' && targetLayer === 'app' && file.split('/')[1] !== target.split('/')[1]) found.push(`${file} → ${target}`);
      continue;
    }
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    const forbidden =
      (layer === 'i18n' && pkg !== 'vitest') ||
      (pkg === 'electron' && layer !== 'infra') ||
      (pkg === 'effect' && (layer === 'domain' || layer === 'ui')) ||
      (pkg.startsWith('node:') && layer !== 'infra' && !(layer === 'core' && spec === 'node:sqlite' && typeOnly));
    if (forbidden) found.push(`${file} → ${spec}`);
  }
  return found;
};

const SRC = path.resolve(__dirname);
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|svelte)$/.test(entry.name) ? [path.relative(SRC, full).split(path.sep).join('/')] : [];
  });

describe('layer rule checker', () => {
  it('reads static, type-only, re-export and dynamic imports', () => {
    expect(
      importsOf(`import { a } from './a';\nimport type { B } from "../b";\nexport * from './c';\nimport './d';\nconst e = await import('./e');\ntype S = typeof import('node:sqlite');\nimport {\n  f,\n  g\n} from './fg';`)
    ).toEqual([
      { spec: './a', typeOnly: false },
      { spec: '../b', typeOnly: true },
      { spec: './c', typeOnly: false },
      { spec: './d', typeOnly: false },
      { spec: './fg', typeOnly: false },
      { spec: './e', typeOnly: false }
    ]);
  });

  it('allows downward imports and rejects upward ones', () => {
    expect(violations('core/engine.ts', "import { x } from '../domain/todos/todo';")).toEqual([]);
    expect(violations('domain/todos/todo.ts', "import { Engine } from '../../core/engine';")).toEqual([
      'domain/todos/todo.ts → core/engine'
    ]);
    expect(violations('core/engine.ts', "import { a } from '../app/todos/module';")).toEqual(['core/engine.ts → app/todos/module']);
  });

  it('reads the script blocks of Svelte components', () => {
    expect(
      violations('ui/Panel.svelte', '<script lang="ts">\nimport { ipcRenderer } from "electron";\n</script>\n<p>\nimport x from "effect"\n</p>')
    ).toEqual(['ui/Panel.svelte → electron']);
    expect(violations('ui/Panel.svelte', '<script lang="ts">import { a } from "../domain/x";</script>')).toEqual([]);
  });

  it('keeps app modules apart and away from legacy folders', () => {
    expect(violations('app/todos/module.ts', "import { r } from './repo';")).toEqual([]);
    expect(violations('app/todos/module.ts', "import { n } from '../notes/module';")).toEqual(['app/todos/module.ts → app/notes/module']);
    expect(violations('app/todos/module.ts', "import { r } from '../../main/db/repository';")).toEqual([
      'app/todos/module.ts → main/db/repository'
    ]);
  });

  it('limits packages per layer', () => {
    expect(violations('core/db.ts', "import type { DatabaseSync } from 'node:sqlite';")).toEqual([]);
    expect(violations('core/db.ts', "import { DatabaseSync } from 'node:sqlite';")).toEqual(['core/db.ts → node:sqlite']);
    expect(violations('app/x/m.ts', "import { app } from 'electron';")).toEqual(['app/x/m.ts → electron']);
    expect(violations('domain/x.ts', "import { Effect } from 'effect';")).toEqual(['domain/x.ts → effect']);
    expect(violations('infra/electron/power.ts', "import { powerMonitor } from 'electron';")).toEqual([]);
    expect(violations('domain/errors/userMessage.ts', "import { t } from '../../i18n';")).toEqual([]);
    expect(violations('i18n/index.ts', "import { x } from '../domain/x';")).toEqual(['i18n/index.ts → domain/x']);
    expect(violations('i18n/index.ts', "import { z } from 'zod';")).toEqual(['i18n/index.ts → zod']);
    expect(violations('main/main.ts', "import { app } from 'electron';")).toEqual([]);
  });
});

describe('source tree', () => {
  it('follows the layer rules', () => {
    const found = sourceFiles(SRC).flatMap((file) => violations(file, readFileSync(path.join(SRC, file), 'utf8')));
    expect(found).toEqual([]);
  });
});
