import type { SceneLayer } from '../domain/layers';
import type { LightingMood, SceneState } from '../domain/scene';

export type RenderableLayer = SceneLayer & {
  renderOpacity: number;
};

export type SceneSize = {
  width: number;
  height: number;
};

export type PixelBlock = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  zIndex: number;
};

const lightingOpacityByMood: Record<LightingMood, Partial<Record<string, number>>> = {
  focus_steady: {
    warm_desk_light: 0.35,
    cool_window_light: 0.25,
    weather_overlay: 0.2,
    fx_sparkle: 0.1
  },
  break_warm: {
    warm_desk_light: 0.72,
    cool_window_light: 0.2,
    weather_overlay: 0.28,
    fx_sparkle: 0.18
  },
  event_dim: {
    background_base: 0.72,
    warm_desk_light: 0.45,
    cool_window_light: 0.18,
    weather_overlay: 0.35,
    fx_sparkle: 0.95
  },
  rain_neon: {
    warm_desk_light: 0.4,
    cool_window_light: 0.65,
    weather_overlay: 0.6,
    fx_sparkle: 0.25
  },
  late_night_quiet: {
    background_base: 0.82,
    warm_desk_light: 0.5,
    cool_window_light: 0.15,
    weather_overlay: 0.18,
    fx_sparkle: 0.08
  },
  morning_soft: {
    background_base: 1,
    warm_desk_light: 0.18,
    cool_window_light: 0.3,
    weather_overlay: 0.08,
    fx_sparkle: 0.05
  }
};

export const getSceneLayerOpacity = (layerKey: string, scene: SceneState): number => {
  const override = lightingOpacityByMood[scene.lightingMood][layerKey];
  return override ?? 1;
};

export const buildRenderableLayers = (layers: SceneLayer[], scene: SceneState): RenderableLayer[] =>
  [...layers]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((layer) => ({
      ...layer,
      renderOpacity: Math.min(layer.opacity, getSceneLayerOpacity(layer.key, scene))
    }));

export const layoutPixelBlocks = (layers: RenderableLayer[], size: SceneSize): PixelBlock[] => {
  const inset = Math.max(8, Math.round(size.width * 0.025));
  const availableWidth = size.width - inset * 2;
  const bandHeight = Math.max(18, Math.round(size.height * 0.045));

  return layers.map((layer, index) => {
    if (layer.key === 'background_base') {
      return {
        key: layer.key,
        x: 0,
        y: 0,
        width: size.width,
        height: size.height,
        color: layer.mockColor,
        opacity: layer.renderOpacity,
        zIndex: layer.zIndex
      };
    }

    const widthStep = Math.max(0, index - 1) * 10;
    const y = inset + index * (bandHeight + 5);

    return {
      key: layer.key,
      x: inset + widthStep,
      y,
      width: Math.max(24, availableWidth - widthStep * 2),
      height: bandHeight,
      color: layer.mockColor,
      opacity: layer.renderOpacity,
      zIndex: layer.zIndex
    };
  });
};
