import { describe, expect, it } from 'vitest';
import { buildPack } from '../domain/character/buildPack';
import type { CharacterDraft, Part } from '../domain/character/parts';
import { blank, hexToPixel, type Pixels } from '../domain/character/pixels';
import { fromTemplate, TEMPLATES, type TemplateId } from '../domain/character/standard';
import { validateImportedPack } from './characterImport';
import { validatePack, type CharacterPack } from './characterPack';

// Every template filled with synthetic boxes (in 1/16ths of the canvas), so
// one table fits every proportion from the floating body to the tall person.
type Rect = [number, number, number, number];
const ART: Record<string, Rect> = {
  body: [5, 6, 11, 12], 'leg.l': [6, 12, 8, 15], 'leg.r': [8, 12, 10, 15], 'foot.l': [5, 12, 7, 15], 'foot.r': [9, 12, 11, 15],
  'arm.l': [3, 6, 5, 10], 'arm.r': [11, 6, 13, 10], head: [4, 1, 12, 6], 'eye.l': [6, 3, 7, 4], 'eye.r': [9, 3, 10, 4], mouth: [7, 5, 9, 6],
  'hair.back': [4, 1, 12, 5], 'hair.front': [4, 1, 12, 2]
};
const filled = (template: TemplateId): CharacterDraft => {
  const d = fromTemplate(template);
  const { w, h } = d.canvas;
  const rect = ([x0, y0, x1, y1]: Rect, dy = 0): Pixels => {
    const px = blank(w, h);
    const [a, b, c, e] = [Math.floor((x0 * w) / 16), Math.floor((y0 * h) / 16) + dy, Math.floor((x1 * w) / 16), Math.floor((y1 * h) / 16)];
    for (let y = b; y < e; y++) for (let x = a; x < c; x++) px.data[y * w + x] = hexToPixel('#884422');
    return px;
  };
  const variantsOf = (p: Part): Record<string, Pixels> | undefined =>
    p.role === 'eye' ? { closed: rect(ART[p.id], 1) } : p.role === 'mouth' ? { open: rect(ART[p.id], -1) } : undefined;
  const parts = d.parts.map((p): Part => ({ ...p, pixels: rect(ART[p.id]), ...(variantsOf(p) ? { variants: variantsOf(p) } : {}) }));
  return { ...d, id: 'bean', name: '콩이', parts };
};

// buildPack's pack with its layers as one sheet row, as the importer sees it.
const roundTrip = (d: CharacterDraft) => {
  const { pack, layers } = buildPack(d);
  const typed: CharacterPack = pack; // the domain pack is a CharacterPack
  return validateImportedPack(JSON.parse(JSON.stringify(typed)), layers.length * d.canvas.w, d.canvas.h);
};

describe('standard pack @3', () => {
  it.each(TEMPLATES.map((t) => t.id))('the %s template round-trips through both validators', (id) => {
    const d = filled(id);
    const pack = JSON.parse(JSON.stringify(buildPack(d).pack));
    expect(() => validatePack(pack)).not.toThrow();
    const imported = roundTrip(d);
    expect(imported.format).toBe('study-pet-character@3');
    expect(imported.frame).toEqual(d.canvas);
    expect(imported.editor).toMatchObject({ version: 1, body: { kind: id === 'floater' ? 'legless' : 'biped', merged: id === 'critter' || id === 'floater' } });
    expect(imported.editor!.parts!.map((p) => p.id)).toEqual(d.parts.map((p) => p.id));
    expect(imported.states.walkR.loop[0].flip).toBe(true);
    expect(Object.keys(imported.expressions!)).toContain('closed');
  });

  it('still accepts @2 and rejects other formats', () => {
    const pack = JSON.parse(JSON.stringify(buildPack(filled('lila')).pack));
    delete pack.editor;
    pack.format = 'study-pet-character@2';
    expect(() => validateImportedPack(pack, 20 * 96, 112)).not.toThrow();
    pack.format = 'study-pet-character@4';
    expect(() => validateImportedPack(pack, 20 * 96, 112)).toThrow();
    expect(() => validatePack(pack)).toThrow(/unsupported format/);
  });

  it('round-trips a draft with a re-parented part, a new part and a moved pivot', () => {
    const d = filled('chibi');
    d.parts = d.parts.map((p) => (p.id === 'hair.front' ? { ...p, parent: 'root', pivot: [40, 10] as [number, number] } : p));
    const tail = { id: 'tail', label: '꼬리', role: 'tail' as const, parent: 'body', pixels: d.parts.find((p) => p.id === 'arm.r')!.pixels };
    const imported = roundTrip({ ...d, parts: [...d.parts, tail] });
    expect(imported.layers.find((l) => l.id === 'tail')!.follow).toEqual(['body', 'tail']);
    expect(imported.editor!.parts!.find((p) => p.id === 'hair.front')).toEqual({ id: 'hair.front', label: '앞머리', parent: 'root', role: 'hair', pivot: [40, 10] });
  });
});
