import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { compile } from 'svelte/compiler';
import sveltePlugin from 'esbuild-svelte';
import { describe, expect, it } from 'vitest';
import { svelteOptions } from './svelte-options.mjs';

// The renderer runs under CSP script-src 'self': no eval, no new Function.
describe('Svelte in the renderer bundle', () => {
  it('bundles a Svelte component for the renderer without eval', async () => {
    const out = await build({
      entryPoints: ['src/ui/mount.ts'], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022',
      logLevel: 'silent', plugins: [sveltePlugin(svelteOptions)]
    });
    const js = out.outputFiles[0].text;
    expect(js).toContain('petnudge-probe');
    expect(js).not.toMatch(/\beval\(|new Function\(/);
  });

  // tsc does not read .svelte files: compiling them is their type and syntax check.
  it('compiles every component in src/ui without errors or warnings', () => {
    const files = readdirSync('src/ui', { recursive: true }).filter((f) => f.endsWith('.svelte'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(path.join('src/ui', file), 'utf8');
      const { warnings } = compile(source, { filename: file, ...svelteOptions.compilerOptions });
      expect(warnings.map((w) => `${file}: ${w.code} ${w.message}`)).toEqual([]);
    }
  });
});
