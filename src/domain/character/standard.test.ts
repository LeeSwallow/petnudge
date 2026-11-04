import { describe, expect, it } from 'vitest';
import { STANDARD_SLOTS, standardPart } from './standard';

describe('standard slots', () => {
  it('lists the editor slots, back to front, with only the body required', () => {
    expect(STANDARD_SLOTS.map((s) => s.id)).toEqual(['hairBack', 'torso', 'legs', 'arms', 'head', 'eyes', 'mouth', 'hairFront', 'custom']);
    expect(STANDARD_SLOTS.filter((s) => s.required).map((s) => s.id)).toEqual(['torso']);
    expect(STANDARD_SLOTS.every((s) => s.label.length > 0)).toBe(true);
  });

  it('names the layers of each slot like the built-in packs', () => {
    const layers = Object.fromEntries(STANDARD_SLOTS.map((s) => [s.id, s.parts.map((p) => p.name)]));
    expect(layers).toEqual({
      hairBack: ['hair.back'],
      torso: ['torso.chest', 'torso.belly'],
      legs: ['leg.L', 'leg.R'],
      arms: ['arm.L', 'arm.R'],
      head: ['head'],
      eyes: ['eye.L.open', 'eye.L.closed', 'eye.R.open', 'eye.R.closed'],
      mouth: ['mouth.closed', 'mouth.open'],
      hairFront: ['hair.front'],
      custom: []
    });
  });

  it('says which hit area and region each part feeds', () => {
    expect(standardPart('hair.back')).toMatchObject({ slot: 'hairBack', layer: 'hair.back', hitArea: 'head', regions: ['head'] });
    expect(standardPart('torso.chest')).toMatchObject({ slot: 'torso', hitArea: 'chest' });
    expect(standardPart('torso.belly')).toMatchObject({ slot: 'torso', hitArea: 'belly' });
    expect(standardPart('leg.R')).toMatchObject({ slot: 'legs', hitArea: 'legR', regions: ['legR'] });
    expect(standardPart('arm.L')).toMatchObject({ slot: 'arms', hitArea: 'armL', regions: ['armL'] });
    expect(standardPart('eye.R.closed')).toMatchObject({ slot: 'eyes', layer: 'eye.R', variant: 'closed', hitArea: 'head', regions: ['head', 'eyes'] });
    expect(standardPart('mouth.open')).toMatchObject({ slot: 'mouth', layer: 'mouth', variant: 'open', hitArea: 'head' });
  });

  it('accepts custom decorations by name and nothing else', () => {
    expect(standardPart('custom.ribbon')).toMatchObject({ slot: 'custom', layer: 'custom.ribbon', regions: [] });
    expect(standardPart('custom.ribbon')?.hitArea).toBeUndefined();
    expect(standardPart('custom.')).toBeUndefined();
    expect(standardPart('custom.a.b')).toBeUndefined();
    expect(standardPart('iris.L.open')).toBeUndefined();
    expect(standardPart('eye.L.smile')).toBeUndefined();
  });
});
