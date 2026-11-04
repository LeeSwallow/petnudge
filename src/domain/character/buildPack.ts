import type { ActionDef, Box, CharacterPack, Expression, FrameDef, HitArea, LayerDef, StateDef } from './pack';
import { bounds, type Pixels } from './pixels';
import { BODY, FACE_LAYERS, FRAME, STANDARD_SLOTS, standardPart, type CharacterDraft, type DraftLines, type PartInfo } from './standard';

// Draft → standard pack (@3) and the pictures to save as its layers. Nothing
// here is authored by hand: regions and hit areas come from the parts'
// bounding boxes, expressions from the eye and mouth variants, and states and
// actions from a template of region moves that fits any picture.

export type BuiltLayer = { name: string; pixels: Pixels };
export type BuiltPack = { pack: CharacterPack; layers: BuiltLayer[] };

// Neutral lines for reactions the user left empty.
export const DEFAULT_LINES: Readonly<DraftLines> = {
  pat: ['헤헤, 좋아요.', '기분 좋아요.', '고마워요.'],
  pokeChest: ['앗, 왜요?', '깜짝 놀랐어요.', '거긴 좀…'],
  pokeBelly: ['간지러워요.', '히익!', '배는 안 돼요.']
};

const union = (boxes: Box[]): Box | undefined =>
  boxes.length ? [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))] : undefined;

const inside = ([x0, y0, x1, y1]: Box, x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1;

// Face variants each expression wants, eyes and mouth. A layer without the
// wanted picture shows the one it has, so every expression (and the blink)
// exists whatever was drawn.
const EXPRESSIONS: Record<string, { eye: string; mouth: string }> = {
  open: { eye: 'open', mouth: 'closed' },
  closed: { eye: 'closed', mouth: 'closed' },
  talkA: { eye: 'open', mouth: 'open' },
  smile: { eye: 'closed', mouth: 'open' },
  surprised: { eye: 'open', mouth: 'open' }
};

// Template states: region moves only, based on the built-in packs. Walking
// flips the picture toward where she goes (art faces left, walkR is mirrored)
// and bobs; being dragged shakes instead of a flail pose.
const WALK: FrameDef[] = [
  { ms: 130 },
  { ms: 130, dy: -1, move: { legL: [0, -1], armR: [0, 1] } },
  { ms: 130 },
  { ms: 130, dy: -1, move: { legR: [0, -1], armL: [0, 1] } }
];
const walk = (flip: boolean): FrameDef[] => WALK.map((f) => (flip ? { ...f, flip } : f));

const TEMPLATE_STATES: Record<string, StateDef> = {
  idle: { look: true, blink: { everyMs: 4200, ms: 140 }, loop: [{ ms: 700 }, { ms: 350, move: { upper: [0, -1] } }, { ms: 500, move: { upper: [0, -1] } }, { ms: 350, move: { upper: [0, -1] } }, { ms: 600 }] },
  patted: { face: 'smile', loop: [{ ms: 260, move: { head: [0, 1], legL: [0, -1] } }, { ms: 260 }] },
  pouty: { face: 'open', start: [{ ms: 140, face: 'surprised', dy: -1 }], loop: [{ ms: 420, move: { head: [0, -1], legR: [0, -1] } }, { ms: 420 }] },
  poked: { face: 'surprised', start: [{ ms: 160, dy: -2 }, { ms: 120, dy: -1 }], loop: [{ ms: 400 }] },
  dragged: {
    face: 'surprised',
    loop: [
      { ms: 90, dx: -1, dy: -2, move: { legL: [0, -2], armL: [0, -1] } },
      { ms: 90, dx: 1, dy: -1, move: { legR: [0, -2], armR: [0, -1] } },
      { ms: 90, dx: -1, dy: -2, move: { legL: [0, -1] } },
      { ms: 90, dx: 1, dy: -1, move: { legR: [0, -1] } }
    ]
  },
  sleep: { face: 'closed', loop: [{ ms: 900, move: { head: [0, 1] } }, { ms: 900, move: { head: [0, 2] } }, { ms: 700, move: { head: [0, 2], upper: [0, 1] } }, { ms: 700, move: { head: [0, 1] } }] },
  celebrate: { face: 'smile', loop: [{ ms: 120, dy: -1 }, { ms: 140, dy: -4, move: { legL: [0, -1], legR: [0, -1], armL: [0, -2], armR: [0, -2] } }, { ms: 120, dy: -2 }, { ms: 160, move: { upper: [0, 1] } }] },
  walkL: { loop: walk(false) },
  walkR: { loop: walk(true) }
};

const TEMPLATE_ACTIONS: Record<keyof DraftLines, Omit<ActionDef, 'lines'>> = {
  pat: { label: '머리 쓰다듬기', area: 'head', tap: true, menu: true, state: 'patted', ms: 1600, fx: 'hearts' },
  pokeChest: { label: '가슴 콕', area: 'chest', menu: true, state: 'pouty', ms: 1600, fx: 'anger' },
  pokeBelly: { label: '배 콕', area: 'belly', menu: true, state: 'poked', ms: 1100, fx: 'sweat' }
};

// Trimmed, non-empty, within the pack's limits (32 lines of 280 characters).
const linesOf = (lines: string[] | undefined, fallback: readonly string[]) => {
  const clean = (lines ?? []).map((l) => l.trim()).filter(Boolean).slice(0, 32).map((l) => l.slice(0, 280));
  return clean.length ? clean : [...fallback];
};

// A state without moves on regions this character has not.
const keepRegions = (state: StateDef, regions: Record<string, Box[]>): StateDef => {
  const frame = (f: FrameDef): FrameDef => {
    if (!f.move) return { ...f };
    const move = Object.fromEntries(Object.entries(f.move).filter(([r]) => regions[r]));
    const { move: _, ...rest } = f;
    return Object.keys(move).length ? { ...rest, move } : rest;
  };
  return { ...state, ...(state.start ? { start: state.start.map(frame) } : {}), loop: state.loop.map(frame) };
};

export const buildPack = (draft: CharacterDraft): BuiltPack => {
  // Parts with something drawn; an empty picture is an empty slot.
  const info = new Map<string, PartInfo & { box: Box; pixels: Pixels }>();
  for (const [name, pixels] of Object.entries(draft.parts)) {
    const part = standardPart(name);
    if (!part) throw new Error(`표준 칸에 없는 부위예요: ${name}`);
    if (pixels.w !== FRAME.w || pixels.h !== FRAME.h) throw new Error(`부위 그림은 ${FRAME.w}×${FRAME.h}여야 해요: ${name}`);
    const box = bounds(pixels);
    if (box) info.set(name, { ...part, box, pixels });
  }
  const body = info.get(BODY);
  if (!body) throw new Error(`몸통(${BODY}) 그림이 필요해요`);

  // Back to front: the draft order, then the rest in slot order.
  const slotOrder = [...STANDARD_SLOTS.flatMap((s) => s.parts.map((p) => p.name)), ...info.keys()];
  const names = [...new Set([...draft.order, ...slotOrder])].filter((n) => info.has(n));
  const layerIds = [...new Set(names.map((n) => info.get(n)!.layer))];
  const pictures = layerIds.flatMap((id) => (FACE_LAYERS[id] ? FACE_LAYERS[id].map((v) => `${id}.${v}`) : [id]).filter((n) => info.has(n)));
  const boxesOf = (pred: (p: PartInfo) => boolean) => [...info.values()].filter(pred).map((p) => p.box);

  // The waist: the belly's top when the torso is two pictures, else the middle of the one.
  const belly = info.get('torso.belly');
  const [, cy0, , cy1] = body.box;
  const waist = belly ? belly.box[1] : Math.max(cy0 + 1, Math.floor((cy0 + cy1) / 2));

  const regions: Record<string, Box[]> = {};
  if (waist >= 1) regions.upper = [[0, 0, FRAME.w, waist]];
  const head = union(boxesOf((p) => p.regions.includes('head')));
  if (head) regions.head = [head];
  const eyes = ['eye.L', 'eye.R'].flatMap((id): Box[] => {
    const box = union(boxesOf((p) => p.layer === id));
    return box ? [box] : [];
  });
  if (eyes.length) regions.eyes = eyes;
  for (const region of ['legL', 'legR', 'armL', 'armR'] as const) {
    const box = union(boxesOf((p) => p.regions.includes(region)));
    if (box) regions[region] = [box];
  }

  const followOf = (id: string): string[] | undefined => {
    const part = [...info.values()].find((p) => p.layer === id)!;
    if (id === 'torso.chest') return belly ? ['upper'] : undefined; // one picture bends at the waist
    if (id === 'torso.belly') return [];
    if (part.slot === 'custom') {
      const [x0, y0, x1, y1] = part.box;
      const [cx, cy] = [Math.floor((x0 + x1) / 2), Math.floor((y0 + y1) / 2)];
      if (head && inside(head, cx, cy)) return ['upper', 'head'];
      return cy < waist ? ['upper'] : [];
    }
    if (part.slot === 'arms') return ['upper', ...part.regions];
    return part.regions.includes('eyes') ? ['upper', 'head', 'eyes'] : part.regions.includes('head') ? ['upper', 'head'] : [...part.regions];
  };
  const layers: LayerDef[] = layerIds.map((id) => {
    const follow = followOf(id)?.filter((r) => regions[r]);
    return { id, ...(FACE_LAYERS[id] ? { from: 'face' as const } : {}), ...(follow ? { follow } : {}) };
  });

  const hitAreas: Record<string, HitArea> = {};
  const covering = (area: string) => layerIds.filter((id) => [...info.values()].some((p) => p.layer === id && p.hitArea === area));
  if (covering('head').length) hitAreas.head = { layers: covering('head') };
  if (belly) {
    hitAreas.chest = { layers: [BODY] };
    hitAreas.belly = { layers: ['torso.belly'] };
  } else {
    // One torso picture: the boxes above and below the waist.
    const [x0, y0, x1, y1] = body.box;
    hitAreas.chest = [[x0, y0, x1, Math.min(waist, y1)]];
    if (waist < y1) hitAreas.belly = [[x0, waist, x1, y1]];
  }
  for (const area of ['armL', 'armR', 'legL', 'legR']) if (covering(area).length) hitAreas[area] = { layers: covering(area) };

  const faceIds = layerIds.filter((id) => FACE_LAYERS[id]);
  const variantFor = (id: string, want: string) => {
    const has = FACE_LAYERS[id].filter((v) => info.has(`${id}.${v}`));
    return has.includes(want) ? want : has[0];
  };
  const expressions: Record<string, Expression> = Object.fromEntries(Object.entries(EXPRESSIONS).map(([name, want]) => [
    name,
    Object.fromEntries(faceIds.map((id) => [id, variantFor(id, id === 'mouth' ? want.mouth : want.eye)]))
  ]));

  const states = Object.fromEntries(Object.entries(TEMPLATE_STATES).map(([name, state]) => [name, keepRegions(state, regions)]));
  const actions: Record<string, ActionDef> = {};
  for (const [id, action] of Object.entries(TEMPLATE_ACTIONS) as [keyof DraftLines, Omit<ActionDef, 'lines'>][]) {
    if (hitAreas[action.area!]) actions[id] = { ...action, lines: linesOf(draft.lines?.[id], DEFAULT_LINES[id]) };
  }

  const persona = draft.persona?.trim();
  const pack: CharacterPack = {
    format: 'study-pet-character@3',
    editor: { version: 1 },
    id: draft.id,
    name: draft.name.trim(),
    ...(persona ? { persona } : {}),
    frame: { w: FRAME.w, h: FRAME.h },
    feetY: Math.max(...[...info.values()].map((p) => p.box[3])),
    sheet: 'sheet.png',
    // One row, in layer order: a preview can draw from the layers as they are.
    cells: Object.fromEntries(pictures.map((name, i) => [name, [i * FRAME.w, 0] as [number, number]])),
    layers,
    expressions,
    regions,
    states,
    slots: {},
    fallback: 'idle',
    hitAreas,
    actions
  };
  return { pack, layers: pictures.map((name) => ({ name, pixels: info.get(name)!.pixels })) };
};
