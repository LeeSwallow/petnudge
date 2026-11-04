import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toCssVars } from '../src/ui/theme/tokens';

// The tokens keep the panel's colours: every :root colour of the older
// stylesheet is still there, under the same name, with the same value.
describe('design tokens against the legacy stylesheet', () => {
  it('keeps every legacy :root colour with the same value', () => {
    const root = readFileSync('src/renderer/styles.css', 'utf8').match(/:root\s*{([^}]*)}/)[1];
    const colours = [...root.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)];
    expect(colours.length).toBe(17);
    for (const [, name, value] of colours) expect(toCssVars()).toContain(`--${name}: ${value};`);
  });
});
