// Mods: block-based behaviour scripts (see docs/superpowers/specs/2026-10-15-mods-design.md).
// Shared by the main process (validation on load) and the renderer (running).
import { z } from 'zod';

const name = z.string().regex(/^[a-zA-Z][a-zA-Z0-9._@#-]{0,79}$/);
const ms = z.number().int().min(0).max(600_000);
const range = z.tuple([z.number().int().min(500), z.number().int().min(500)]);
const fx = z.enum(['hearts', 'stars', 'anger', 'sweat', 'sparkles']);
const lines = z.array(z.string().max(280)).min(1).max(32);

// Things that happen to the pet. Each fires `before` (the thing waits for the
// behaviour to finish) and `after`.
export const PET_EVENTS = ['tap', 'action', 'emote', 'walk', 'drag', 'focusStart', 'focusEnd', 'breakStart', 'breakEnd',
  'panelOpen', 'panelClose', 'characterChange', 'musicStart', 'musicStop', 'chat', 'friendNear', 'friendLeave', 'friendTalk'] as const;
export type PetEvent = (typeof PET_EVENTS)[number];

export const whenBlock = z.discriminatedUnion('block', [
  z.object({ block: z.literal('tap'), area: name.optional() }),
  z.object({ block: z.literal('menu'), label: z.string().min(1).max(40) }),
  z.object({ block: z.literal('random'), everyMs: range }),
  z.object({ block: z.literal('idle'), afterMs: ms }),
  z.object({ block: z.literal('timer'), event: z.enum(['focusStart', 'focusEnd', 'breakStart', 'breakEnd']) }),
  z.object({ block: z.literal('music'), playing: z.boolean() }),
  z.object({ block: z.literal('drag'), phase: z.enum(['start', 'end']) }),
  z.object({ block: z.literal('time'), hour: z.number().int().min(0).max(23) }),
  z.object({ block: z.literal('event'), name: z.enum(PET_EVENTS), phase: z.enum(['before', 'after']) }),
  // A friend pet comes near (enters her area), leaves, or has stayed near
  // for `afterMs` (fires once per visit). `who`: a character id, or anyone.
  z.object({ block: z.literal('friend'), phase: z.enum(['near', 'leave', 'stay']), who: name.optional(), afterMs: ms.optional() })
]);

type IfBlock =
  | { block: 'chance'; p: number }
  | { block: 'timer'; mode: 'idle' | 'focus' | 'break' }
  | { block: 'hours'; from: number; to: number }
  | { block: 'music'; playing: boolean }
  | { block: 'character'; ids: string[] }
  | { block: 'walking'; value: boolean }
  | { block: 'not'; if: IfBlock };
export const ifBlock: z.ZodType<IfBlock> = z.lazy(() => z.discriminatedUnion('block', [
  z.object({ block: z.literal('chance'), p: z.number().min(0).max(1) }),
  z.object({ block: z.literal('timer'), mode: z.enum(['idle', 'focus', 'break']) }),
  z.object({ block: z.literal('hours'), from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(24) }),
  z.object({ block: z.literal('music'), playing: z.boolean() }),
  z.object({ block: z.literal('character'), ids: z.array(name).min(1) }),
  z.object({ block: z.literal('walking'), value: z.boolean() }),
  z.object({ block: z.literal('not'), if: ifBlock })
])) as z.ZodType<IfBlock>;

type DoBlock =
  | { block: 'play'; state: string; ms: number; fx?: z.infer<typeof fx>; line?: string }
  | { block: 'say'; lines: string[] }
  | { block: 'fx'; kind: z.infer<typeof fx>; ms: number }
  | { block: 'face'; face: string; ms: number }
  | { block: 'wait'; ms: number }
  | { block: 'walk'; dx: number; dy: number }
  | { block: 'action'; id: string }
  | { block: 'random'; branches: DoBlock[][] }
  | { block: 'repeat'; times: number; do: DoBlock[] }
  | { block: 'talk'; turns: number; topic?: string }
  | { block: 'stop' };
export const doBlock: z.ZodType<DoBlock> = z.lazy(() => z.discriminatedUnion('block', [
  z.object({ block: z.literal('play'), state: name, ms, fx: fx.optional(), line: z.string().max(280).optional() }),
  z.object({ block: z.literal('say'), lines }),
  z.object({ block: z.literal('fx'), kind: fx, ms }),
  z.object({ block: z.literal('face'), face: name, ms }),
  z.object({ block: z.literal('wait'), ms }),
  z.object({ block: z.literal('walk'), dx: z.number().int().min(-800).max(800), dy: z.number().int().min(-600).max(600) }),
  z.object({ block: z.literal('action'), id: name }),
  z.object({ block: z.literal('random'), branches: z.array(z.array(doBlock).max(64)).min(1).max(16) }),
  z.object({ block: z.literal('repeat'), times: z.number().int().min(1).max(20), do: z.array(doBlock).min(1).max(64) }),
  // Face the friend nearby and chat (AI) for `turns` lines in total.
  z.object({ block: z.literal('talk'), turns: z.number().int().min(2).max(12), topic: z.string().max(200).optional() }),
  z.object({ block: z.literal('stop') })
])) as z.ZodType<DoBlock>;

const frame = z.object({
  ms: z.number().int().min(16).max(60_000), dx: z.number().int().min(-32).max(32).optional(), dy: z.number().int().min(-32).max(32).optional(),
  face: name.optional(), head: name.optional(), pose: name.optional(),
  move: z.record(name, z.tuple([z.number().int().min(-32).max(32), z.number().int().min(-32).max(32)])).optional()
});

export const behaviorSchema = z.object({
  id: name,
  name: z.string().max(80).optional(),
  when: whenBlock,
  if: z.array(ifBlock).max(16).optional(),
  cooldownMs: ms.optional(),
  priority: z.number().int().min(-100).max(100).optional(),
  do: z.array(doBlock).min(1).max(128)
});

export const modSchema = z.object({
  format: z.literal('study-pet-mod@1'),
  id: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),
  name: z.string().min(1).max(80),
  description: z.string().max(400).optional(),
  characters: z.array(z.union([z.literal('*'), name])).min(1).default(['*']),
  states: z.record(name, z.object({
    face: name.optional(), look: z.boolean().optional(),
    start: z.array(frame).max(128).optional(), loop: z.array(frame).min(1).max(128)
  })).optional(),
  behaviors: z.array(behaviorSchema).max(128).default([])
});

export type Mod = z.infer<typeof modSchema>;
export type Behavior = z.infer<typeof behaviorSchema>;
export type WhenBlock = z.infer<typeof whenBlock>;
export type { DoBlock, IfBlock };

// What the app shows in Settings and hands to the renderer.
export type ModInfo = { mod: Mod; builtin: boolean; enabled: boolean; path: string };
export type ModProblem = { path: string; error: string };

export const parseMod = (input: unknown): Mod => modSchema.parse(input);
