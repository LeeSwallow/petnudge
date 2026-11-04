import { describe, expect, it } from 'vitest';
import { buildPack } from '../domain/character/buildPack';
import { blank, hexToPixel, type Pixels } from '../domain/character/pixels';
import type { CharacterDraft } from '../domain/character/standard';
import { validateImportedPack } from './characterImport';
import { validatePack, type CharacterPack } from './characterPack';

const rect = (x0: number, y0: number, x1: number, y1: number): Pixels => {
  const px = blank(96, 112);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.data[y * 96 + x] = hexToPixel('#884422');
  return px;
};

const draft = (parts: Record<string, Pixels>): CharacterDraft => ({
  id: 'bean', name: '콩이', persona: '', lines: { pat: [], pokeChest: [], pokeBelly: [] }, parts, order: Object.keys(parts)
});

const full = () => draft({
  'hair.back': rect(24, 6, 72, 50), 'leg.L': rect(36, 80, 46, 108), 'leg.R': rect(50, 80, 60, 108),
  'arm.L': rect(22, 50, 30, 76), 'arm.R': rect(66, 50, 74, 76), 'torso.chest': rect(30, 50, 66, 64), 'torso.belly': rect(32, 62, 64, 82),
  head: rect(28, 10, 68, 48), 'eye.L.open': rect(36, 26, 40, 30), 'eye.L.closed': rect(36, 28, 40, 29), 'eye.R.open': rect(56, 26, 60, 30),
  'eye.R.closed': rect(56, 28, 60, 29), 'mouth.closed': rect(44, 38, 52, 40), 'mouth.open': rect(44, 37, 52, 42), 'hair.front': rect(26, 6, 70, 20),
  'custom.ribbon': rect(60, 8, 70, 14)
});

// buildPack's pack with its layers as one sheet row, as the importer sees it.
const roundTrip = (d: CharacterDraft) => {
  const { pack, layers } = buildPack(d);
  const typed: CharacterPack = pack; // the domain pack is a CharacterPack
  return validateImportedPack(JSON.parse(JSON.stringify(typed)), layers.length * 96, 112);
};

describe('standard pack @3', () => {
  it('is accepted by both validators, with the editor mark and frame flips', () => {
    const pack = JSON.parse(JSON.stringify(buildPack(full()).pack));
    expect(() => validatePack(pack)).not.toThrow();
    const imported = validateImportedPack(pack, 16 * 96, 112);
    expect(imported.format).toBe('study-pet-character@3');
    expect(imported.editor).toEqual({ version: 1 });
    expect(imported.states.walkR.loop[0].flip).toBe(true);
  });

  it('still accepts @2 and rejects other formats', () => {
    const pack = JSON.parse(JSON.stringify(buildPack(full()).pack));
    delete pack.editor;
    pack.format = 'study-pet-character@2';
    expect(() => validateImportedPack(pack, 16 * 96, 112)).not.toThrow();
    pack.format = 'study-pet-character@4';
    expect(() => validateImportedPack(pack, 16 * 96, 112)).toThrow();
    expect(() => validatePack(pack)).toThrow(/unsupported format/);
  });

  it('accepts lines and persona per language, and plain ones (#77)', () => {
    const pack = JSON.parse(JSON.stringify(buildPack(full()).pack));
    const pat = Object.keys(pack.actions)[0];
    pack.lang = 'ko';
    pack.persona = { ko: '느긋한 친구', en: 'A laid-back friend' };
    pack.actions[pat].lines = { ko: ['헤헤'], en: ['Hehe'], ja: ['えへへ'] };
    const imported = validateImportedPack(pack, 16 * 96, 112);
    expect(imported.persona).toEqual({ ko: '느긋한 친구', en: 'A laid-back friend' });
    expect(imported.actions![pat].lines).toEqual({ ko: ['헤헤'], en: ['Hehe'], ja: ['えへへ'] });
    pack.persona = '느긋한 친구';
    pack.actions[pat].lines = ['헤헤'];
    expect(() => validateImportedPack(pack, 16 * 96, 112)).not.toThrow();
    pack.actions[pat].lines = { english: ['Hehe'] };
    expect(() => validateImportedPack(pack, 16 * 96, 112)).toThrow();
  });

  it('round-trips a full draft and a body-only draft through the importer', () => {
    expect(roundTrip(full()).id).toBe('bean');
    expect(Object.keys(roundTrip(draft({ 'torso.chest': rect(30, 50, 66, 80) })).states)).toContain('walkR');
    expect(Object.keys(roundTrip(draft({ 'torso.chest': rect(30, 50, 66, 80), 'eye.L.closed': rect(36, 28, 40, 29) })).expressions!)).toContain('closed');
  });
});
