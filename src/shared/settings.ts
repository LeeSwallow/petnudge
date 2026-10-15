import type { Avatar, CharacterPack } from './characterPack';

export type AppSettings = {
  characterId: string;
  characterAvatars: Record<string, Avatar>;
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  dailyGoalSessions: number;
  autoStartFocus: boolean;
  musicSync: boolean;
  musicVolume: number;
  focusPlaylistId: string | null;
  breakPlaylistId: string | null;
  alwaysOnTop: boolean;
  petScale: number;
  eyesFollowCursor: boolean;
  // Wander around the screen now and then (not during focus sessions).
  walkAround: boolean;
  reduceMotion: boolean;
  nickname: string;
  // Character customisation: variant ids of the active character pack's slots.
  avatarHair: string;
  avatarOutfit: string;
  avatarHeadwear: string;
  avatarLed: string;
};

export const defaultSettings: AppSettings = {
  characterId: 'lila',
  characterAvatars: {},
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
  dailyGoalSessions: 8,
  autoStartFocus: false,
  musicSync: false,
  musicVolume: 70,
  focusPlaylistId: null,
  breakPlaylistId: null,
  alwaysOnTop: true,
  petScale: 2,
  eyesFollowCursor: true,
  walkAround: true,
  reduceMotion: false,
  nickname: '',
  avatarHair: 'lavender',
  avatarOutfit: 'jacket',
  avatarHeadwear: 'catphones',
  avatarLed: 'violet'
};

// Which setting holds the chosen variant of each character pack slot.
export const avatarSettingFor: Record<string, keyof AppSettings> = {
  hair: 'avatarHair',
  outer: 'avatarOutfit',
  headwear: 'avatarHeadwear',
  glow: 'avatarLed'
};

export const avatarFor = (pack: CharacterPack, settings: AppSettings): Avatar =>
  settings.characterAvatars[pack.id] ?? (pack.id === 'lila'
    ? Object.fromEntries(Object.entries(avatarSettingFor).map(([slot, key]) => [slot, String(settings[key])]))
    : {});

const ranges: Partial<Record<keyof AppSettings, [number, number]>> = {
  focusMinutes: [1, 120],
  breakMinutes: [1, 60],
  longBreakMinutes: [1, 90],
  longBreakEvery: [2, 10],
  dailyGoalSessions: [1, 24],
  petScale: [2, 5],
  musicVolume: [0, 100]
};

// Merges untrusted input (IPC, stored JSON) over defaults, dropping unknown
// keys and wrong types and clamping numbers into range.
export const normalizeSettings = (input: unknown): AppSettings => {
  const source = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const result = { ...defaultSettings } as Record<string, unknown>;

  for (const key of Object.keys(defaultSettings) as (keyof AppSettings)[]) {
    const value = source[key];
    const fallback = defaultSettings[key];
    if (key === 'characterId') {
      if (typeof value === 'string' && /^[a-z][a-z0-9-]{0,47}$/.test(value)) result[key] = value;
    } else if (key === 'characterAvatars' && value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = Object.fromEntries(Object.entries(value).slice(0, 100).filter(([id]) => /^[a-z][a-z0-9-]{0,47}$/.test(id)).map(([id, avatar]) => [id,
        Object.fromEntries(Object.entries(avatar && typeof avatar === 'object' && !Array.isArray(avatar) ? avatar : {}).slice(0, 32)
          .filter(([slot, variant]) => /^[a-zA-Z][a-zA-Z0-9._-]{0,79}$/.test(slot) && typeof variant === 'string' && /^[a-zA-Z][a-zA-Z0-9._-]{0,79}$/.test(variant)))
      ]));
    } else if (typeof fallback === 'number' && typeof value === 'number' && Number.isFinite(value)) {
      const [min, max] = ranges[key] ?? [-Infinity, Infinity];
      result[key] = Math.min(max, Math.max(min, Math.round(value)));
    } else if (typeof fallback === 'boolean' && typeof value === 'boolean') {
      result[key] = value;
    } else if (key.startsWith('avatar')) {
      if (typeof value === 'string' && /^[a-z][a-z0-9-]{0,23}$/.test(value)) result[key] = value;
    } else if (key === 'nickname') {
      result[key] = typeof value === 'string' ? value.trim().slice(0, 16) : '';
    } else if (key === 'focusPlaylistId' || key === 'breakPlaylistId') {
      result[key] = typeof value === 'string' && value.length > 0 ? value : null;
    }
  }
  return result as AppSettings;
};
