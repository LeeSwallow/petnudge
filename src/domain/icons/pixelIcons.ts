// Shared source pixels: desktop SVGs and mobile views use the same palette.
const palette: Record<string, string> = {
  o: '#473462', w: '#fff3df', y: '#ffd078', s: '#e7a65a', r: '#df6074',
  p: '#ffb5c4', v: '#b9a0e2', b: '#87cce5', g: '#7bc79d'
};

export const pixelIcons = {
  tomato: ['...gg...', '..gggg..', '.orrrro.', 'orwrrrro', 'orrrrrro', 'orrrrrro', '.orrrro.', '..oooo..'],
  fire: ['....r...', '...ry...', '..rryr..', '.rryyr..', '.rywwyr.', 'orywwyro', 'orryyrro', '.orrrro.'],
  tired: ['..oooo..', '.oyyyyo.', 'oyoyyoyo', 'oyyoyyyo', 'oyoyyoyo', 'oyyppyyo', '.oyyyyo.', '..oooo..'],
  unsure: ['..oooo..', '.oyyyyo.', 'oyoyyoyo', 'oyyyyyyo', 'oyyyyyyo', 'oyyoooyo', '.oyyyyo.', '..oooo..'],
  steady: ['..oooo..', '.oyyyyo.', 'oyoyyoyo', 'oyyyyyyo', 'oyyyyyyo', 'oyyooyyo', '.oyyyyo.', '..oooo..'],
  happy: ['..oooo..', '.oyyyyo.', 'oyoyyoyo', 'oyyyyyyo', 'opoyyopo', 'oyyooyyo', '.oyyyyo.', '..oooo..'],
  play: ['..b.....', '..bb....', '..bbb...', '..bbbb..', '..bbbb..', '..bbb...', '..bb....', '..b.....'],
  pause: ['........', '.bb..bb.', '.bb..bb.', '.bb..bb.', '.bb..bb.', '.bb..bb.', '.bb..bb.', '........'],
  stop: ['........', '.rrrrrr.', '.rrrrrr.', '.rrrrrr.', '.rrrrrr.', '.rrrrrr.', '.rrrrrr.', '........'],
  next: ['.b....b.', '.bb...b.', '.bbb..b.', '.bbbb.b.', '.bbbb.b.', '.bbb..b.', '.bb...b.', '.b....b.'],
  check: ['........', '......g.', '.....gg.', '.g..gg..', '.gggg...', '..gg....', '........', '........'],
  close: ['........', '.r....r.', '..r..r..', '...rr...', '...rr...', '..r..r..', '.r....r.', '........'],
  up: ['........', '...b....', '..bbb...', '.bbbbb..', '...b....', '...b....', '........', '........'],
  down: ['........', '...b....', '...b....', '.bbbbb..', '..bbb...', '...b....', '........', '........'],
  back: ['........', '...b....', '..bb....', '.bbbbbb.', '..bb....', '...b....', '........', '........'],
  star: ['...y....', '...y....', '.yyyyy..', '..yyy...', '..yyy...', '.yy.yy..', '........', '........'],
  sparkle: ['....y...', '....y...', '..yyyyy.', '....y...', '.y......', 'yyy.....', '.y......', '........'],
  flower: ['........', '..pp....', '.pppp...', '..pypp..', '.pppp...', '..ppg...', '....g...', '...gg...'],
  lock: ['..oooo..', '.obbbbo.', '.ob..bo.', '.oooooo.', '.oyyyyo.', '.oyoyyo.', '.oyoyyo.', '.oooooo.'],
  clock: ['..oooo..', '.obbbbo.', 'obbowbbo', 'obbowbbo', 'obbwoobo', 'obbbbbbo', '.obbbbo.', '..oooo..'],
  chart: ['........', '......g.', '...b..g.', '...b..g.', '.v.b..g.', '.v.b..g.', '.v.b..g.', 'oooooooo'],
  pencil: ['.....yy.', '....yyo.', '...yyo..', '..yyo...', '.yyo....', '.wo.....', '.o......', '........'],
  note: ['.oooooo.', '.owwwwo.', '.ovvvwo.', '.owwwwo.', '.ovvvwo.', '.owwwwo.', '.owwwwo.', '.oooooo.'],
  music: ['...bbbbb', '...b...b', '...b...b', '...b...b', '.bbb.bbb', 'bbbbbbbb', '.bb..bb.', '........'],
  mail: ['........', '.oooooo.', 'obwwwwbo', 'owbwwbwo', 'owwbbwwo', 'owwwwwwo', '.oooooo.', '........'],
  gear: ['..v..v..', '.vvvvvv.', 'vvvoovvv', '.vo..ov.', '.vo..ov.', 'vvvoovvv', '.vvvvvv.', '..v..v..'],
  power: ['...rr...', '.r.rr.r.', 'r..rr..r', 'r..rr..r', 'r......r', 'r......r', '.r....r.', '..rrrr..'],
  talk: ['.oooooo.', 'owwwwwwo', 'owvwvwvo', 'owwwwwwo', '.oowooo.', '..ow....', '..o.....', '........'],
  home: ['...vv...', '..vvvv..', '.vvvvvv.', 'vvvvvvvv', '.vwwwwv.', '.vwvvwv.', '.vwvvwv.', '.vvvvvv.']
} as const;

export type PixelIconName = keyof typeof pixelIcons;
export const pixelPalette = palette;
export const moodIcons: PixelIconName[] = ['tired', 'unsure', 'steady', 'happy', 'fire'];
export const moodLabels = ['많이 지쳤어요', '집중이 어려웠어요', '괜찮았어요', '잘 집중했어요', '아주 몰입했어요'];
