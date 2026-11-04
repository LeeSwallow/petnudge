import { describe, expect, it } from 'vitest';
import lila from '../../assets/characters/lila/character.json';
import { validatePack } from './characterPack';
import { avatarFor, defaultSettings, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('returns defaults for garbage input', () => {
    expect(normalizeSettings(null)).toEqual(defaultSettings);
    expect(normalizeSettings('x')).toEqual(defaultSettings);
  });

  it('keeps a known language and drops anything else (#77)', () => {
    expect(defaultSettings.locale).toBe('en');
    expect(normalizeSettings({ locale: 'ja' }).locale).toBe('ja');
    expect(normalizeSettings({ locale: 'ko' }).locale).toBe('ko');
    expect(normalizeSettings({ locale: 'xx' }).locale).toBe('xx');
    expect(normalizeSettings({ locale: 'fr' }).locale).toBe('en');
    expect(normalizeSettings({ locale: 3 }).locale).toBe('en');
  });

  it('leaves music sync off for a new profile', () => {
    expect(defaultSettings.musicSync).toBe(false);
    expect(normalizeSettings({ musicSync: true }).musicSync).toBe(true);
  });

  it('leaves the global chat shortcut off for a new profile (it takes keys from other apps)', () => {
    expect(defaultSettings.chatShortcut).toBe(false);
    expect(normalizeSettings({ chatShortcut: true }).chatShortcut).toBe(true);
    expect(normalizeSettings({ chatShortcut: 'on' }).chatShortcut).toBe(false);
  });

  it('keeps valid values, clamps numbers, and drops wrong types and unknown keys', () => {
    const settings = normalizeSettings({
      focusMinutes: 500,
      breakMinutes: 7.4,
      musicSync: 'yes',
      autoStartFocus: true,
      focusPlaylistId: 'p1',
      breakPlaylistId: '',
      avatarHeadwear: 'none',
      avatarHair: 'pink',
      avatarOutfit: '<script>',
      evil: 1
    });

    expect(settings.focusMinutes).toBe(120);
    expect(settings.breakMinutes).toBe(7);
    expect(settings.musicSync).toBe(false);
    expect(settings.autoStartFocus).toBe(true);
    expect(settings.focusPlaylistId).toBe('p1');
    expect(settings.breakPlaylistId).toBeNull();
    expect(settings.avatarHeadwear).toBe('none');
    // hair colour was removed with the colour slots (#50)
    expect(settings).not.toHaveProperty('avatarHair');
    expect(settings.avatarOutfit).toBe('jacket');
    expect(settings).not.toHaveProperty('evil');
  });
});

describe('avatarFor', () => {
  const pack = validatePack(lila);
  const withAvatar = (avatar: Record<string, string>) => normalizeSettings({ characterAvatars: { lila: avatar } });

  it('loads saved colour choices without errors and ignores them (#50)', () => {
    expect(avatarFor(pack, withAvatar({ skin: 'tan', hair: 'pink', glow: 'cyan', outer: 'cardigan', headwear: 'none' }))).toEqual({ outer: 'cardigan', headwear: 'none', hairpin: 'clip' });
    expect(avatarFor(pack, normalizeSettings({ avatarHair: 'pink', avatarLed: 'cyan' }))).toEqual({ outer: 'jacket', headwear: 'catphones', hairpin: 'clip' });
  });

  it('switches a saved combination with no walk drawings to the closest one, keeping the outer', () => {
    expect(avatarFor(pack, withAvatar({ outer: 'jacket', headwear: 'none', hairpin: 'none' }))).toEqual({ outer: 'jacket', headwear: 'catphones', hairpin: 'none' });
    expect(avatarFor(pack, withAvatar({ outer: 'cardigan', headwear: 'catphones' }))).toEqual({ outer: 'cardigan', headwear: 'none', hairpin: 'clip' });
    expect(avatarFor(pack, withAvatar({ outer: 'none', headwear: 'catphones' }))).toEqual({ outer: 'none', headwear: 'none', hairpin: 'clip' });
  });
});
