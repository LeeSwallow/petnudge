import { describe, expect, it } from 'vitest';
import { defaultSettings, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('returns defaults for garbage input', () => {
    expect(normalizeSettings(null)).toEqual(defaultSettings);
    expect(normalizeSettings('x')).toEqual(defaultSettings);
  });

  it('keeps valid values, clamps numbers, and drops wrong types and unknown keys', () => {
    const settings = normalizeSettings({
      focusMinutes: 500,
      breakMinutes: 7.4,
      musicSync: 'yes',
      autoStartFocus: true,
      focusPlaylistId: 'p1',
      breakPlaylistId: '',
      avatarHair: 'pink',
      avatarOutfit: '<script>',
      evil: 1
    });

    expect(settings.focusMinutes).toBe(120);
    expect(settings.breakMinutes).toBe(7);
    expect(settings.musicSync).toBe(true);
    expect(settings.autoStartFocus).toBe(true);
    expect(settings.focusPlaylistId).toBe('p1');
    expect(settings.breakPlaylistId).toBeNull();
    expect(settings.avatarHair).toBe('pink');
    expect(settings.avatarOutfit).toBe('jacket');
    expect(settings).not.toHaveProperty('evil');
  });
});
