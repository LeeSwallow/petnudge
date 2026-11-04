import { describe, expect, it } from 'vitest';
import { toCssVars } from './tokens';

describe('design tokens', () => {
  it('exposes the scales as variables', () => {
    const css = toCssVars();
    expect(css).toContain('--space-1: 4px;');
    expect(css).toContain('--shadow-md: 4px;');
    expect(css).toContain('--color-ink: #f4edff;');
    expect(css).toContain('--type-body: 12px;');
    expect(css).toContain('--color-edge-lo: #4b3f7a;');
  });
});
