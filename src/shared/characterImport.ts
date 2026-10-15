import { z } from 'zod';
import { hasFace, validatePack, type CharacterPack } from './characterPack';

const integer = z.number().int();
const name = z.string().regex(/^[a-zA-Z][a-zA-Z0-9._@#-]{0,79}$/);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const box = z.tuple([integer.min(0), integer.min(0), integer.min(1), integer.min(1)]);
const move = z.tuple([integer.min(-32).max(32), integer.min(-32).max(32)]);
const frame = z.object({
  ms: integer.min(16).max(60_000), dx: integer.min(-32).max(32).optional(), dy: integer.min(-32).max(32).optional(),
  face: name.optional(), head: name.optional(), pose: name.optional(), move: z.record(name, move).optional()
});
const schema = z.object({
  format: z.literal('study-pet-character@2'), id: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/), name: z.string().min(1).max(80), persona: z.string().max(600).optional(),
  frame: z.object({ w: integer.min(1).max(256), h: integer.min(1).max(256) }), feetY: integer.min(0), sheet: z.literal('sheet.png'),
  cells: z.record(name, z.tuple([integer.min(0), integer.min(0)])),
  layers: z.array(z.object({
    id: name, from: z.enum(['slot', 'face']).optional(), follow: z.array(name).max(8).optional(),
    clip: name.optional(), clipFollow: z.array(name).max(8).optional(), group: z.literal('body').optional(),
    edge: z.object({ color, opacity: z.number().min(0).max(1), light: color.optional() }).optional(),
    ignore: z.array(name).max(16).optional()
  })).min(1).max(64),
  expressions: z.record(name, z.record(name, name)).optional(),
  poses: z.record(name, z.union([name, z.object({ cell: name, whole: z.boolean().optional(), outfits: z.array(z.object({ when: z.record(name, name), cell: name })).max(16).optional() })])).optional(),
  mirror: z.record(name, name).optional(),
  regions: z.record(name, z.array(box).min(1).max(32)),
  states: z.record(name, z.object({
    face: name.optional(), look: z.boolean().optional(),
    blink: z.object({ everyMs: integer.min(100), ms: integer.min(16) }).optional(),
    start: z.array(frame).max(128).optional(), loop: z.array(frame).min(1).max(128)
  })),
  slots: z.record(name, z.object({
    label: z.string().max(80), swatch: color.optional(),
    variants: z.record(name, z.object({
      label: z.string().max(80), unlock: z.string().max(80).optional(),
      recolor: z.object({ layers: z.array(name).optional(), region: name.optional(), map: z.record(color, color) }).optional(),
      hides: z.array(name).optional()
    }))
  })),
  fallback: name,
  hitAreas: z.record(name, z.union([z.array(box).min(1).max(32), z.object({ layers: z.array(name).min(1).max(64) })])).optional(),
  actions: z.record(name, z.object({
    label: z.string().max(80), area: name.optional(), tap: z.boolean().optional(), menu: z.boolean().optional(),
    state: name, ms: integer.min(16).max(60_000), fx: z.enum(['hearts', 'stars', 'anger', 'sweat', 'sparkles']).optional(),
    lines: z.array(z.string().max(280)).max(32).optional()
  })).optional(),
  fidgets: z.object({ states: z.array(name).min(1).max(32), everyMs: z.tuple([integer.min(1000), integer.min(1000)]) }).optional(),
  emotes: z.object({ actions: z.array(name).min(1).max(32), everyMs: z.tuple([integer.min(1000), integer.min(1000)]) }).optional(),
  outline: z.object({ color, opacity: z.number().min(0).max(1).optional(), width: integer.min(1).max(4).optional() }).optional()
});

export const validateImportedPack = (input: unknown, sheetWidth: number, sheetHeight: number): CharacterPack => {
  const pack = validatePack(schema.parse(input));
  for (const [x, y] of Object.values(pack.cells)) {
    if (x + pack.frame.w > sheetWidth || y + pack.frame.h > sheetHeight) throw new Error('스프라이트 셀 위치가 PNG 범위를 벗어났어요');
  }
  const areaBoxes = Object.values(pack.hitAreas ?? {}).filter((a) => Array.isArray(a));
  for (const boxes of [...Object.values(pack.regions), ...areaBoxes]) for (const [x0, y0, x1, y1] of boxes) {
    if (x0 >= x1 || y0 >= y1 || x1 > pack.frame.w || y1 > pack.frame.h) throw new Error('픽셀 영역이 프레임 범위를 벗어났어요');
  }
  for (const layer of pack.layers) if (layer.from === 'slot') for (const id of Object.keys(pack.slots[layer.id].variants)) {
    if (id !== 'none' && !pack.cells[`${layer.id}.${id}`]) throw new Error(`의상 레이어가 없어요: ${layer.id}.${id}`);
  }
  for (const def of Object.values(pack.states)) {
    if (def.blink && (def.blink.ms >= def.blink.everyMs || !hasFace(pack, 'closed'))) throw new Error('눈 깜빡임 설정이나 표정이 잘못됐어요');
  }
  if (pack.fidgets && pack.fidgets.everyMs[0] > pack.fidgets.everyMs[1]) throw new Error('대기 동작 간격이 잘못됐어요');
  return pack;
};

export type CharacterChoice = { id: string; name: string; editable: boolean; builtin: boolean };
export type CharacterAsset = { pack: CharacterPack; sheetUrl: string };
