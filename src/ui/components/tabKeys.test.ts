import { describe, expect, it } from 'vitest';
import { step } from './tabKeys';

describe('tab keys', () => {
  it('moves between tabs with the arrow, Home and End keys', () => {
    expect(step(['a', 'b', 'c'], 'c', 'ArrowRight')).toBe('a');
    expect(step(['a', 'b', 'c'], 'a', 'ArrowLeft')).toBe('c');
    expect(step(['a', 'b', 'c'], 'b', 'Home')).toBe('a');
    expect(step(['a', 'b', 'c'], 'b', 'End')).toBe('c');
    expect(step(['a', 'b', 'c'], 'b', 'Enter')).toBeNull();
  });

  it('starts from the first tab when the current one is not in the list', () => {
    expect(step(['a', 'b'], 'z', 'ArrowRight')).toBe('a');
  });
});
