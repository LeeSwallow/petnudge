import type { ActionDef, Box, CharacterPack, EditorPartMeta, Expression, FrameDef, HitArea, LayerDef, Move, StateDef } from './pack';
import { ancestorsOf, cellsOf, draftProblems, partBox, picturesOf, restVariant, subtreeOf, unionBox, type CharacterDraft, type DraftLines, type Part, type Role } from './parts';
import type { Pixels } from './pixels';

// Draft → standard pack (@3) and the pictures to save as its layers (#71).
// Nothing here is authored by hand and nothing assumes a proportion: every
// part gets its own region (its box, grown by 1px) and its layer follows its
// own region and all its ancestors' (moving a parent moves its children);
// hit areas come from the roles; expressions from the variants; states and
// actions from a template of moves on roles ("the head", "the left foot"),
// so they fit any part layout: a one-piece critter moves its body for the head.

export type BuiltLayer = { name: string; pixels: Pixels };
export type BuiltPack = { pack: CharacterPack; layers: BuiltLayer[] };

// Neutral lines for reactions the user left empty.
export const DEFAULT_LINES: Readonly<DraftLines> = {
  pat: ['헤헤, 좋아요.', '기분 좋아요.', '고마워요.'],
  pokeChest: ['앗, 왜요?', '깜짝 놀랐어요.', '거긴 좀…'],
  pokeBelly: ['간지러워요.', '히익!', '배는 안 돼요.']
};

// The variants each built-in expression wants, eyes and mouths, best first.
// A part without any of them shows its picture at rest, so every expression
// (and the blink) exists whatever was drawn.
const EXPRESSIONS: Record<string, { eye: string[]; mouth: string[] }> = {
  open: { eye: [], mouth: [] },
  closed: { eye: ['closed'], mouth: [] },
  talkA: { eye: [], mouth: ['open'] },
  smile: { eye: ['smile', 'closed'], mouth: ['smile', 'open'] },
  surprised: { eye: [], mouth: ['open'] }
};
const EXPRESSION_NAME = /^[a-zA-Z][a-zA-Z0-9-]{0,31}$/;

// Template states: moves on role targets. `upper` is the body (the top one),
// `head` the head (the body when it is one piece), `legL`/`legR` the feet on
// the left and right of the picture, `armL`/`armR` the hands. Walking flips
// the picture toward where she goes (art faces left, walkR is mirrored) and
// bobs; with no feet it hops or hovers instead (below).
type Target = 'upper' | 'head' | 'legL' | 'legR' | 'armL' | 'armR';
type TemplateFrame = Omit<FrameDef, 'move'> & { move?: Partial<Record<Target, Move>> };
type TemplateState = Omit<StateDef, 'start' | 'loop'> & { start?: TemplateFrame[]; loop: TemplateFrame[] };
const WALK: TemplateFrame[] = [
  { ms: 130 },
  { ms: 130, dy: -1, move: { legL: [0, -1], armR: [0, 1] } },
  { ms: 130 },
  { ms: 130, dy: -1, move: { legR: [0, -1], armL: [0, 1] } }
];
// Without feet: a body on the ground hops (squash, up, down), a legless one
// hovers along with a slow bob. The whole picture moves; nothing steps.
const HOP: TemplateFrame[] = [
  { ms: 120, move: { upper: [0, 1] } },
  { ms: 110, dy: -2 },
  { ms: 130, dy: -3 },
  { ms: 110, dy: -1 }
];
const HOVER: TemplateFrame[] = [{ ms: 220 }, { ms: 220, dy: -1 }, { ms: 220, dy: -2 }, { ms: 220, dy: -1 }];
const flipped = (frames: TemplateFrame[], flip: boolean): TemplateFrame[] => frames.map((f) => (flip ? { ...f, flip } : f));
const walk = (flip: boolean) => flipped(WALK, flip);

const TEMPLATE_STATES: Record<string, TemplateState> = {
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

const grow = ([x0, y0, x1, y1]: Box, w: number, h: number): Box => [Math.max(0, x0 - 1), Math.max(0, y0 - 1), Math.min(w, x1 + 1), Math.min(h, y1 + 1)];
const centreX = (box: Box) => (box[0] + box[2]) / 2;

export const buildPack = (draft: CharacterDraft): BuiltPack => {
  const problems = draftProblems(draft);
  if (problems.length) throw new Error(problems.map((p) => p.message).join(' · '));
  const { w, h } = draft.canvas;

  // Parts with something drawn; an empty part is left out (its children follow the rest of the chain).
  const drawn = draft.parts.flatMap((part) => {
    const box = partBox(part);
    return box ? [{ part, box }] : [];
  });
  const has = new Set(drawn.map((d) => d.part.id));
  const boxOf = new Map(drawn.map((d) => [d.part.id, d.box]));
  const withRole = (role: Role) => drawn.filter((d) => d.part.role === role);
  const isFace = (part: Part) => Boolean(part.variants && Object.keys(part.variants).length);

  const regions: Record<string, Box[]> = {};
  for (const { part, box } of drawn) regions[part.id] = [grow(box, w, h)];
  const eyes = withRole('eye');
  if (eyes.length) regions.eyes = eyes.map((d) => d.box);

  const followOf = (part: Part) => [...ancestorsOf(draft, part.id).filter((id) => has.has(id)), part.id, ...(part.role === 'eye' ? ['eyes'] : [])];
  const layers: LayerDef[] = drawn.map(({ part }) => ({ id: part.id, ...(isFace(part) ? { from: 'face' as const } : {}), follow: followOf(part) }));
  const pictures: BuiltLayer[] = drawn.flatMap(({ part }) => {
    const all = isFace(part) ? picturesOf(part) : [part.pixels];
    return cellsOf(isFace(part) ? part : { ...part, variants: undefined }).map((name, i) => ({ name, pixels: all[i] }));
  });

  // Role targets for the template moves.
  const bodies = withRole('body').sort((a, b) => a.box[1] - b.box[1]);
  const heads = withRole('head');
  const leftRight = (list: typeof drawn) => {
    const sorted = [...list].sort((a, b) => centreX(a.box) - centreX(b.box));
    const half = Math.floor(sorted.length / 2);
    return [sorted.slice(0, half).map((d) => d.part.id), sorted.slice(half).map((d) => d.part.id)];
  };
  const [feetL, feetR] = leftRight(withRole('foot'));
  const [handsL, handsR] = leftRight(withRole('hand'));
  const targets: Record<Target, string[]> = {
    upper: bodies.slice(0, 1).map((d) => d.part.id),
    head: heads.length ? heads.map((d) => d.part.id) : bodies.slice(0, 1).map((d) => d.part.id),
    legL: feetL,
    legR: feetR,
    armL: handsL,
    armR: handsR
  };
  const frameOf = (f: TemplateFrame): FrameDef => {
    const { move, ...rest } = f;
    const out: Record<string, Move> = {};
    for (const [target, [dx, dy]] of Object.entries(move ?? {}) as [Target, Move][]) {
      for (const id of targets[target]) out[id] = [(out[id]?.[0] ?? 0) + dx, (out[id]?.[1] ?? 0) + dy];
    }
    return Object.keys(out).length ? { ...rest, move: out } : { ...rest };
  };
  const gait = feetL.length + feetR.length ? undefined : draft.body.kind === 'legless' ? HOVER : HOP;
  const template: Record<string, TemplateState> = gait ? { ...TEMPLATE_STATES, walkL: { loop: flipped(gait, false) }, walkR: { loop: flipped(gait, true) } } : TEMPLATE_STATES;
  const states: Record<string, StateDef> = Object.fromEntries(Object.entries(template).map(([name, s]) => [
    name,
    { ...s, ...(s.start ? { start: s.start.map(frameOf) } : {}), loop: s.loop.map(frameOf) } as StateDef
  ]));

  // Hit areas: the head and everything on it (with the hair); the body's
  // halves for chest and belly, or two body parts top and bottom. A one-piece
  // body: its top half is the head, the rest chest and belly.
  const hitAreas: Record<string, HitArea> = {};
  const headLayers = new Set([...heads.flatMap((d) => subtreeOf(draft, d.part.id)), ...withRole('hair').map((d) => d.part.id)]);
  const order = layers.map((l) => l.id);
  const [x0, y0, x1, y1] = unionBox(bodies.map((d) => d.box))!;
  const split = (top: number, bottom: number) => Math.max(top + 1, Math.floor((top + bottom) / 2));
  if (headLayers.size && heads.length) {
    hitAreas.head = { layers: order.filter((id) => headLayers.has(id)) };
    if (bodies.length >= 2) {
      hitAreas.chest = { layers: [bodies[0].part.id] };
      hitAreas.belly = { layers: [bodies[1].part.id] };
    } else {
      const waist = split(y0, y1);
      hitAreas.chest = [[x0, y0, x1, Math.min(waist, y1)]];
      if (waist < y1) hitAreas.belly = [[x0, waist, x1, y1]];
    }
  } else {
    const neck = split(y0, y1);
    hitAreas.head = [[x0, y0, x1, Math.min(neck, y1)]];
    const waist = split(neck, y1);
    if (neck < y1) hitAreas.chest = [[x0, neck, x1, Math.min(waist, y1)]];
    if (waist < y1) hitAreas.belly = [[x0, waist, x1, y1]];
  }
  const areaOf = (ids: string[]) => (ids.length ? { layers: ids } : undefined);
  for (const [area, ids] of [['armL', handsL], ['armR', handsR], ['legL', feetL], ['legR', feetR]] as const) {
    const def = areaOf(ids);
    if (def) hitAreas[area] = def;
  }

  // Expressions: per face part (one with variants) the variant shown.
  const faces = drawn.filter((d) => isFace(d.part)).map((d) => d.part);
  const variantFor = (part: Part, wants: readonly string[]) => wants.find((v) => part.variants?.[v]) ?? restVariant(part);
  const expressions: Record<string, Expression> = Object.fromEntries(Object.entries(EXPRESSIONS).map(([name, want]) => [
    name,
    Object.fromEntries(faces.map((part) => [part.id, variantFor(part, part.role === 'eye' ? want.eye : part.role === 'mouth' ? want.mouth : [])]))
  ]));
  for (const [name, picks] of Object.entries(draft.expressions ?? {})) {
    if (!EXPRESSION_NAME.test(name)) continue;
    expressions[name] = Object.fromEntries(faces.map((part) => [part.id, variantFor(part, picks[part.id] ? [picks[part.id]] : [])]));
  }

  const actions: Record<string, ActionDef> = {};
  for (const [id, action] of Object.entries(TEMPLATE_ACTIONS) as [keyof DraftLines, Omit<ActionDef, 'lines'>][]) {
    if (hitAreas[action.area!]) actions[id] = { ...action, lines: linesOf(draft.lines?.[id], DEFAULT_LINES[id]) };
  }

  const meta = draft.parts.map((part): EditorPartMeta => ({
    id: part.id, label: part.label, parent: part.parent, ...(part.role ? { role: part.role } : {}), ...(part.pivot ? { pivot: [...part.pivot] as [number, number] } : {})
  }));
  const persona = draft.persona?.trim();
  const pack: CharacterPack = {
    format: 'study-pet-character@3',
    editor: { version: 1, body: { ...draft.body }, parts: meta },
    id: draft.id,
    name: draft.name.trim(),
    ...(persona ? { persona } : {}),
    frame: { w, h },
    // On the ground: the lowest foot, or the lowest pixel of a body without feet.
    feetY: Math.max(...(withRole('foot').length ? withRole('foot') : drawn).map((d) => d.box[3])),
    sheet: 'sheet.png',
    // One row, in layer order: a preview can draw from the layers as they are.
    cells: Object.fromEntries(pictures.map(({ name }, i) => [name, [i * w, 0] as [number, number]])),
    layers,
    expressions,
    regions,
    states,
    slots: {},
    fallback: 'idle',
    hitAreas,
    actions
  };
  return { pack, layers: pictures };
};
