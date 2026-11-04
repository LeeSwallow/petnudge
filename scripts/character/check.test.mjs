import { describe, expect, it } from 'vitest';
import { checkPixels, irisProblems, poseColourMismatches } from './check.mjs';

// A picture from rows of letters; '.' is transparent.
const W = 5;
const H = 5;
const abgr = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return ((0xff << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
};
const pic = (rows, colours) => {
  const data = new Uint32Array(W * H);
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') data[y * W + x] = abgr(colours[c]); }));
  return { w: W, h: H, data };
};
const pictures = (cells) => new Map(Object.entries(cells));

const SKIN = '#fddfdf';
const SHADE = '#f9d0d1';
const HAIR = '#d1bedf';
const LINE = '#1a1030';

const pack = {
  frame: { w: W, h: H },
  layers: [
    { id: 'hair.back', group: 'body' },
    { id: 'head', group: 'body' },
    { id: 'shoe.L', group: 'body', edge: { color: LINE, opacity: 0.5 } },
    { id: 'eye.L', from: 'face' },
    { id: 'iris.L', from: 'face', clip: 'socket.L' }
  ],
  expressions: { open: { 'iris.L': 'open' }, surprised: { 'eye.L': 'surprised', 'iris.L': 'surprised' } },
  poses: { walk1: { cell: 'pose.walk1', whole: true } },
  slots: {},
  states: { idle: { loop: [{ ms: 100 }] } }
};

describe('pose colours', () => {
  const standing = {
    'hair.back': pic(['hhhhh'], { h: HAIR }),
    head: pic(['.....', 'sssss', 'ttttt'], { s: SKIN, t: SHADE })
  };

  it('accepts a whole pose drawn in the colours the standing character uses', () => {
    const cells = pictures({ ...standing, 'pose.walk1': pic(['hhh', 'sst', 'lll'], { h: HAIR, s: SKIN, t: SHADE, l: LINE }) });
    expect(poseColourMismatches(pack, cells)).toEqual([]);
  });

  it('reports each colour of a whole pose the standing character never uses, with the nearest one it does', () => {
    // a paler skin: what Lila's walk was drawn in (#66)
    const cells = pictures({ ...standing, 'pose.walk1': pic(['hhh', 'ppp', 'pps'], { h: HAIR, s: SKIN, p: '#fbf2f5' }) });
    expect(poseColourMismatches(pack, cells)).toEqual([{ cell: 'pose.walk1', colour: '#fbf2f5', count: 5, nearest: SKIN }]);
  });

  it('checks a part drawn for a pose against every standing colour (a hood drawn with the fringe in it)', () => {
    const cells = pictures({ ...standing, 'hair.back#walk1': pic(['hhs', 'p..'], { h: HAIR, s: SKIN, p: '#fbf2f5' }) });
    expect(poseColourMismatches(pack, cells)).toEqual([{ cell: 'hair.back#walk1', colour: '#fbf2f5', count: 1, nearest: SKIN }]);
  });
});

describe('irises', () => {
  const PURPLE = '#8246af';
  const DARK = '#382054';
  const SHINE = '#f8edf4';
  const socket = pic(['.....', '.mmm.', '.mmm.', '.mmm.', '.....'], { m: '#ffffff' });

  it('accepts a solid iris inside its socket, highlight and all', () => {
    const cells = pictures({ 'socket.L.open': socket, 'iris.L.open': pic(['.....', '.wpp.', '.pdp.', '.ppp.', '.....'], { w: SHINE, p: PURPLE, d: DARK }) });
    expect(irisProblems(pack, cells)).toEqual([]);
  });

  it('reports iris pixels, a highlight among them, the socket mask cuts off', () => {
    const cells = pictures({ 'socket.L.open': socket, 'iris.L.open': pic(['...w.', '.ppp.', '.pdp.', '.ppp.', '.....'], { w: SHINE, p: PURPLE, d: DARK }) });
    expect(irisProblems(pack, cells)).toEqual([{ cell: 'iris.L.open', mask: 'socket.L.open', outside: 1, outsideHighlights: 1, holes: 0 }]);
  });

  it('reports holes inside the iris, where the eye layer shows through and stays put when the iris moves', () => {
    const cells = pictures({ 'socket.L.open': socket, 'iris.L.open': pic(['.....', '.ppp.', '.p.d.', '.ppp.', '.....'], { p: PURPLE, d: DARK }) });
    expect(irisProblems(pack, cells)).toEqual([{ cell: 'iris.L.open', mask: 'socket.L.open', outside: 0, outsideHighlights: 0, holes: 1 }]);
  });

  it('checks every expression that has an iris and a mask', () => {
    const cells = pictures({
      'socket.L.open': socket,
      'iris.L.open': pic(['.....', '.ppp.', '.ppp.', '.ppp.', '.....'], { p: PURPLE }),
      'socket.L.surprised': socket,
      'iris.L.surprised': pic(['.....', '.....', '.....', '.....', '..p..'], { p: PURPLE })
    });
    expect(irisProblems(pack, cells).map((p) => p.cell)).toEqual(['iris.L.surprised']);
  });
});

describe('checkPixels', () => {
  it('turns both into export warnings', () => {
    const cells = pictures({
      head: pic(['sssss'], { s: SKIN }),
      'pose.walk1': pic(['ppp'], { p: '#fbf2f5' }),
      'socket.L.open': pic(['.m...'], { m: '#ffffff' }),
      'iris.L.open': pic(['pp...'], { p: '#8246af' })
    });
    const { errors, warnings } = checkPixels(pack, cells);
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/pose\.walk1.*#fbf2f5.*3.*#fddfdf/);
    expect(warnings[1]).toMatch(/iris\.L\.open.*1/);
  });
});
