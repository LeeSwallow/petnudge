import type { CharacterPack, Expression, LayerDef, Recolor, Variant } from './pack';
import { blank, bounds, clipTo, hexToPixel, over, recolor, type Pixels } from './pixels';
import type { CharacterDraft } from './parts';
import { fromLegacyDraft, LEGACY_FRAME as FRAME, type DraftLines, type LegacyDraft } from './standard';

// An @2 pack (lila, moa, maru) → a draft of parts. Only the front view with
// the default avatar is kept: each part is the @2 layers that draw it there,
// merged back to front in the pack's layer order (first under the fixed
// names of #54, then as parts with roles and parents, standard.ts). Turned
// heads, poses, other expressions and other outfits have no part; they come
// back in `dropped`, each with the reason, so the editor can show them first.

export type SourceLayer = { name: string; pixels: Pixels };
export type Dropped = { name: string; reason: string };
export type ConvertMeta = { id?: string; name?: string; persona?: string; lines?: DraftLines };
export type Converted = { draft: CharacterDraft; dropped: Dropped[] };

// Face layers that are skin, not features: drawn into the head.
const INTO_HEAD = new Set(['shade', 'blush', 'nose']);
// Body layers drawn into the torso (`armfront.*` too).
const INTO_TORSO = new Set(['neck', 'bottom']);
const PLAIN = new Set(['hair.back', 'hair.front', 'head', 'leg.L', 'leg.R', 'arm.L', 'arm.R']);

// "outer" → "custom.outer"; anything a custom name can't hold becomes "-".
const customName = (id: string) => {
  const clean = id.replace(/[^a-zA-Z0-9-]/g, '-');
  return `custom.${(/^[a-zA-Z]/.test(clean) ? clean : `x${clean}`).slice(0, 32)}`;
};

const firstVariant = (pack: CharacterPack, slot: string): [string, Variant] | undefined => Object.entries(pack.slots[slot]?.variants ?? {})[0];

export const convertPack = (pack: CharacterPack, layers: SourceLayer[], meta: ConvertMeta = {}): Converted => {
  const source = new Map(layers.map((l) => [l.name, l.pixels]));
  const used = new Set<string>();
  const why = new Map<string, string>();

  // The default avatar: every slot on its first variant.
  const avatar = Object.fromEntries(Object.keys(pack.slots).flatMap((slot) => {
    const first = firstVariant(pack, slot);
    return first ? [[slot, first] as const] : [];
  }));
  const hiddenBy = new Map<string, string>();
  for (const [slot, [id, variant]] of Object.entries(avatar)) for (const layer of variant.hides ?? []) hiddenBy.set(layer, `${slot}.${id}`);
  const recolors: Recolor[] = Object.values(avatar).flatMap(([, v]) => (v.recolor ? [v.recolor] : []));

  const expression = (name: string): Expression | undefined => pack.expressions?.[name];
  const variantIn = (e: Expression | undefined, id: string) => e?.[id] ?? 'open';

  // A cell's pixels as the default avatar draws them (recoloured), or undefined.
  const cell = (def: LayerDef, name: string): Pixels | undefined => {
    const px = source.get(name);
    if (!px) return undefined;
    if (px.w !== FRAME.w || px.h !== FRAME.h) {
      why.set(name, `그림 크기가 ${FRAME.w}×${FRAME.h}가 아니에요`);
      return undefined;
    }
    used.add(name);
    const out: Pixels = { w: px.w, h: px.h, data: px.data.slice() };
    for (const r of recolors) {
      if (r.layers && !r.layers.includes(def.id)) continue;
      const map = new Map(Object.entries(r.map).map(([from, to]) => [hexToPixel(from), hexToPixel(to)]));
      recolor(out, map, r.region ? pack.regions[r.region] : undefined);
    }
    return out;
  };
  // A face layer's cell for expression `e`, clipped by its mask the way the renderer draws it.
  const faceCell = (def: LayerDef, e: Expression | undefined): Pixels | undefined => {
    const variant = variantIn(e, def.id);
    if (variant === 'none') return undefined;
    const px = cell(def, `${def.id}.${variant}`);
    if (!px || !def.clip) return px;
    // The mask only cuts; it is listed as dropped, not as part of the eye.
    const mask = source.get(`${def.clip}.${variant}`);
    return mask && mask.w === px.w && mask.h === px.h ? clipTo(px, mask) : undefined; // no mask: the renderer does not draw it
  };

  // Targets in first-drawn order; each a full canvas the sources are drawn over.
  const parts = new Map<string, Pixels>();
  const draw = (target: string, px: Pixels | undefined) => {
    if (!px) return;
    if (!parts.has(target)) parts.set(target, blank(FRAME.w, FRAME.h));
    over(parts.get(target)!, px);
  };

  const has = (id: string) => pack.layers.some((l) => l.id === id) && source.has(id);
  const twoTorsos = has('torso.chest') && has('torso.belly');
  const torsoFor = (def: LayerDef) => (twoTorsos && !(def.follow ?? []).includes('upper') && def.id !== 'torso.chest' ? 'torso.belly' : 'torso.chest');

  const open = expression('open');
  const closed = expression('closed');
  // The talking mouth: talkA's, else open or smile, whichever is not the resting one.
  const resting = variantIn(open, 'mouth');
  const talking = [expression('talkA')?.mouth, 'open', 'smile'].find((v) => v && v !== 'none' && v !== resting && source.has(`mouth.${v}`));

  for (const def of pack.layers) {
    if (hiddenBy.has(def.id)) continue;
    const { id } = def;
    if (def.from === 'slot') {
      const variant = avatar[id]?.[0];
      if (variant && variant !== 'none') draw(customName(id), cell(def, `${id}.${variant}`));
    } else if (def.from === 'face') {
      const eye = /^(?:eye|iris)\.([LR])$/.exec(id);
      if (eye) {
        draw(`eye.${eye[1]}.open`, faceCell(def, open));
        // The closed eye only when the closed face shows something else.
        const eyeId = `eye.${eye[1]}`;
        if (closed && variantIn(closed, eyeId) !== variantIn(open, eyeId)) draw(`eye.${eye[1]}.closed`, faceCell(def, closed));
      } else if (id === 'mouth') {
        draw('mouth.closed', faceCell(def, open));
        if (talking) draw('mouth.open', cell(def, `mouth.${talking}`));
      } else if (INTO_HEAD.has(id)) draw('head', faceCell(def, open));
      else draw(customName(id), faceCell(def, open));
    } else if (id === 'torso.chest' || id === 'torso.belly' || INTO_TORSO.has(id) || id.startsWith('armfront.')) {
      draw(torsoFor(def), cell(def, id));
    } else if (/^shoe\.[LR]$/.test(id)) draw(`leg.${id.slice(5)}`, cell(def, id));
    else if (INTO_HEAD.has(id)) draw('head', cell(def, id));
    else if (PLAIN.has(id)) draw(id, cell(def, id));
    else draw(customName(id), cell(def, id));
  }

  // Why each layer that went into no part was left out.
  const owners = [...pack.layers.map((l) => l.id), ...pack.layers.flatMap((l) => (l.clip ? [l.clip] : []))].sort((a, b) => b.length - a.length);
  const poseCells = new Set(Object.values(pack.poses ?? {}).flatMap((d) => (typeof d === 'string' ? [d] : [d.cell, ...(d.outfits ?? []).map((o) => o.cell)])));
  const reasonFor = (name: string): string => {
    const [rest, pose] = name.split('#');
    const [base, head] = rest.split('@');
    if (pose) return `자세(#${pose}) 그림이에요. 표준 팩은 자세 그림 없이 영역 이동으로 움직여요`;
    if (head) return `고개 돌린 그림(@${head})이에요. 표준 팩은 정면 그림만 써요`;
    if (poseCells.has(base) || base.startsWith('pose.')) return '통째로 그린 자세 그림이에요. 표준 팩은 걷기를 좌우 반전으로 해요';
    const owner = owners.find((id) => base === id || base.startsWith(`${id}.`));
    if (!owner) return '팩이 그리지 않는 레이어라 맞는 칸이 없어요';
    const def = pack.layers.find((l) => l.id === owner);
    if (!def) return '눈동자를 자르는 마스크예요. 눈에 합칠 때 잘라 내는 데 쓰고 따로 두지 않아요';
    if (hiddenBy.has(owner)) return `기본 옷(${hiddenBy.get(owner)})에 가려 정면에서 보이지 않는 레이어예요`;
    const variant = base.slice(owner.length + 1);
    if (def.from === 'slot') {
      const chosen = avatar[owner]?.[0];
      return chosen && chosen !== 'none' ? `기본 옷(${owner}.${chosen})이 아닌 옷 변형이에요` : `기본 옷 차림에서는 입지 않는 옷 변형이에요(${owner} 기본: 없음)`;
    }
    if (def.from === 'face') return `다른 표정(${variant || owner}) 그림이에요. 표준 팩의 표정은 눈 뜬/감은, 입 닫은/연 것뿐이에요`;
    return '표준 칸에 맞는 자리가 없어요';
  };
  const dropped: Dropped[] = layers.filter((l) => !used.has(l.name)).map((l) => ({ name: l.name, reason: why.get(l.name) ?? reasonFor(l.name) }));

  // Empty merges (an empty `armfront.L`) are no part.
  const kept = [...parts].filter(([, px]) => bounds(px));
  const linesOf = (id: keyof DraftLines) => [...(pack.actions?.[id]?.lines ?? [])];
  const legacy: LegacyDraft = {
    id: meta.id ?? pack.id,
    name: meta.name ?? pack.name,
    persona: (meta.persona ?? pack.persona ?? '').slice(0, 600),
    lines: meta.lines ? { pat: [...meta.lines.pat], pokeChest: [...meta.lines.pokeChest], pokeBelly: [...meta.lines.pokeBelly] } : { pat: linesOf('pat'), pokeChest: linesOf('pokeChest'), pokeBelly: linesOf('pokeBelly') },
    parts: Object.fromEntries(kept),
    order: kept.map(([name]) => name)
  };
  return { draft: fromLegacyDraft(legacy), dropped };
};
