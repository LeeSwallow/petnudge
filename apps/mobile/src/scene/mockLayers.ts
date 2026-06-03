import type { SceneLayer } from '../domain/layers';

export const mockSceneLayers: SceneLayer[] = [
  {
    key: 'background_base',
    kind: 'background',
    label: 'Base room placeholder',
    zIndex: 0,
    mockColor: '#17142c',
    opacity: 1
  },
  {
    key: 'window_time_variant',
    kind: 'timeVariant',
    label: 'Window time variant',
    zIndex: 10,
    mockColor: '#273f7a',
    opacity: 0.8
  },
  {
    key: 'weather_overlay',
    kind: 'weather',
    label: 'Rain / snow overlay',
    zIndex: 20,
    mockColor: '#8fc7ff',
    opacity: 0.35
  },
  {
    key: 'warm_desk_light',
    kind: 'lighting',
    label: 'Warm desk light mask',
    zIndex: 30,
    mockColor: '#ffb86b',
    opacity: 0.45
  },
  {
    key: 'cool_window_light',
    kind: 'lighting',
    label: 'Cool window rim light',
    zIndex: 31,
    mockColor: '#7aa2ff',
    opacity: 0.3
  },
  {
    key: 'room_objects',
    kind: 'roomObjects',
    label: 'Story trace objects',
    zIndex: 40,
    mockColor: '#ff6fae',
    opacity: 0.85
  },
  {
    key: 'character_sprite',
    kind: 'character',
    label: 'Companion sprite placeholder',
    zIndex: 50,
    mockColor: '#ffd1e8',
    opacity: 1
  },
  {
    key: 'fx_sparkle',
    kind: 'fx',
    label: 'Unlock sparkle FX',
    zIndex: 60,
    mockColor: '#f7f26b',
    opacity: 0.6
  }
];
