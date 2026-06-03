import { describe, expect, it } from 'vitest';
import type { SceneState } from '../domain/scene';
import { mockSceneLayers } from './mockLayers';
import { buildRenderableLayers, getSceneLayerOpacity, layoutPixelBlocks } from './skiaLayerModel';

const baseState: SceneState = {
  phase: 'focus_active',
  lightingMood: 'focus_steady',
  characterAnimation: 'focus_writing',
  dialogueTurn: 0,
  maxRewardDialogueTurns: 2,
  inputLocked: false
};

describe('skiaLayerModel', () => {
  it('sorts renderable layers by zIndex so Skia can draw back to front', () => {
    const renderable = buildRenderableLayers([...mockSceneLayers].reverse(), baseState);

    expect(renderable.map((layer) => layer.key)).toEqual([
      'background_base',
      'window_time_variant',
      'weather_overlay',
      'warm_desk_light',
      'cool_window_light',
      'room_objects',
      'character_sprite',
      'fx_sparkle'
    ]);
  });

  it('raises warm desk light opacity during break dialogue', () => {
    const focusOpacity = getSceneLayerOpacity('warm_desk_light', baseState);
    const breakOpacity = getSceneLayerOpacity('warm_desk_light', {
      ...baseState,
      phase: 'break_dialogue_active',
      lightingMood: 'break_warm'
    });

    expect(breakOpacity).toBeGreaterThan(focusOpacity);
  });

  it('dims the room and emphasizes fx during event scenes', () => {
    const eventState: SceneState = {
      ...baseState,
      phase: 'event_scene_active',
      lightingMood: 'event_dim',
      characterAnimation: 'object_sparkle'
    };

    expect(getSceneLayerOpacity('background_base', eventState)).toBeLessThan(1);
    expect(getSceneLayerOpacity('fx_sparkle', eventState)).toBeGreaterThan(
      getSceneLayerOpacity('fx_sparkle', baseState)
    );
  });

  it('creates stable portrait mock rectangles for every layer', () => {
    const blocks = layoutPixelBlocks(buildRenderableLayers(mockSceneLayers, baseState), {
      width: 360,
      height: 520
    });

    expect(blocks).toHaveLength(mockSceneLayers.length);
    expect(blocks[0]).toMatchObject({ key: 'background_base', x: 0, y: 0, width: 360, height: 520 });
    expect(blocks.every((block) => block.width > 0 && block.height > 0)).toBe(true);
  });
});
