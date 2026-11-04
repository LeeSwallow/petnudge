import { describe, expect, it } from 'vitest';
import { buildPack } from './buildPack';
import { blank, hexToPixel, type Pixels } from './pixels';
import { addPart, emptyDraft, setPivot, setPixels } from './placement';
import { draftFromPack } from './reopen';

const rect = (x0: number, y0: number, x1: number, y1: number, w = 72, h = 72): Pixels => {
  const px = blank(w, h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.data[y * w + x] = hexToPixel('#884422');
  return px;
};

const critter = () => {
  let d = emptyDraft('critter');
  d = setPixels(d, 'body', rect(16, 20, 56, 62));
  d = setPixels(d, 'foot.l', rect(20, 60, 30, 70));
  d = setPixels(d, 'foot.r', rect(40, 60, 50, 70));
  d = setPixels(d, 'eye.l', rect(28, 30, 32, 34));
  d = setPixels(d, 'eye.l', rect(28, 32, 32, 33), 'closed');
  d = setPivot(d, 'body', [36, 60]);
  const tail = addPart(d, { label: '꼬리', role: 'tail', parent: 'body' });
  d = setPixels(tail.draft, tail.id, rect(56, 40, 66, 46));
  return { ...d, id: 'bean', name: '콩이', lines: { pat: ['좋아'], pokeChest: [], pokeBelly: [] }, expressions: { wink: { 'eye.l': 'closed' } } };
};

describe('opening a standard pack again', () => {
  it('gives back the parts, their structure and pictures: building it again makes the same pack', () => {
    const before = buildPack(critter());
    const { draft, dropped } = draftFromPack(before.pack, before.layers);
    expect(dropped).toEqual([]);
    expect(draft.canvas).toEqual({ w: 72, h: 72 });
    expect(draft.parts.map((p) => [p.id, p.parent, p.role])).toEqual(critter().parts.map((p) => [p.id, p.parent, p.role]));
    expect(draft.parts.find((p) => p.id === 'body')!.pivot).toEqual([36, 60]);
    expect(draft.expressions).toEqual({ wink: { 'eye.l': 'closed' } });
    expect(buildPack(draft)).toEqual(before);
  });

  it('lists layers it has no part for', () => {
    const { pack, layers } = buildPack(critter());
    const { dropped } = draftFromPack(pack, [...layers, { name: 'sketch', pixels: rect(0, 0, 1, 1) }]);
    expect(dropped).toEqual([{ name: 'sketch', reason: '부위에 없는 레이어예요' }]);
  });

  it('opens an older standard pack by its fixed layer names', () => {
    const r = (x0: number, y0: number, x1: number, y1: number) => rect(x0, y0, x1, y1, 96, 112);
    const pack = { format: 'study-pet-character@3', editor: { version: 1 }, id: 'old', name: '옛', frame: { w: 96, h: 112 }, actions: {} } as never;
    const { draft, dropped } = draftFromPack(pack, [
      { name: 'torso.chest', pixels: r(30, 50, 66, 80) }, { name: 'leg.L', pixels: r(36, 80, 46, 108) }, { name: 'eye.L.closed', pixels: r(36, 28, 40, 29) }, { name: 'iris.L.open', pixels: r(0, 0, 1, 1) }
    ]);
    expect(draft.parts.map((p) => p.id)).toEqual(['body', 'leg.l', 'eye.l']);
    expect(dropped.map((d) => d.name)).toEqual(['iris.L.open']);
  });
});
