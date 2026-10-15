import { describe, expect, it } from 'vitest';
import { pixelPalette, moodIcons } from '../../../mobile/src/domain/pixelIcons';
import { pixelIcon, pixelIcons } from './icons';

describe('pixel icons', () => {
  it('keeps every icon on an 8×8 grid with only palette colours', () => {
    for (const rows of Object.values(pixelIcons)) {
      expect(rows).toHaveLength(8);
      for (const row of rows) {
        expect(row).toHaveLength(8);
        for (const c of row) expect(c === '.' || c in pixelPalette).toBe(true);
      }
    }
    expect(new Set(moodIcons).size).toBe(5);
  });

  it('labels meaningful images safely and hides decorative ones', () => {
    expect(pixelIcon('fire', '<몰입>')).toContain('aria-label="&lt;몰입&gt;"');
    expect(pixelIcon('fire')).toContain('aria-hidden="true"');
  });
});
