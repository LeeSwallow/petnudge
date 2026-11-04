import { build } from 'esbuild';
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
});
