import type { Converted, Dropped, SourceLayer } from './convert';
import type { CharacterPack } from './pack';
import { isPartId, restVariant, ROLES, validCanvas, type CharacterDraft, type Part, type Role } from './parts';
import { blank, type Pixels } from './pixels';
import { fromLegacyDraft, LEGACY_FRAME, legacyPart, type LegacyDraft } from './standard';

// A standard pack (@3) opened again in the editor: its layers back into
// parts. A pack made with free parts (#71) keeps its part structure in
// `editor.parts`; an older one (#54) has the fixed layer names, mapped onto
// parts like an old draft. Layers with no part come back in `dropped`.

const BUILT_IN_FACES = new Set(['open', 'closed', 'talkA', 'smile', 'surprised']);
const linesOf = (pack: CharacterPack, id: 'pat' | 'pokeChest' | 'pokeBelly') => [...(pack.actions?.[id]?.lines ?? [])];

export const draftFromPack = (pack: CharacterPack, layers: readonly SourceLayer[]): Converted => {
  const lines = { pat: linesOf(pack, 'pat'), pokeChest: linesOf(pack, 'pokeChest'), pokeBelly: linesOf(pack, 'pokeBelly') };
  const identity = { id: pack.id, name: pack.name, persona: pack.persona ?? '', lines };
  const pictures = new Map(layers.map((l) => [l.name, l.pixels]));
  const used = new Set<string>();
  const dropped: Dropped[] = [];

  const meta = pack.editor?.parts;
  if (!meta?.length || !validCanvas(pack.frame)) {
    const parts: Record<string, Pixels> = {};
    for (const { name, pixels } of layers) {
      if (!legacyPart(name) || parts[name]) dropped.push({ name, reason: '표준 칸에 없는 레이어예요' });
      else if (pixels.w !== LEGACY_FRAME.w || pixels.h !== LEGACY_FRAME.h) dropped.push({ name, reason: `그림 크기가 ${LEGACY_FRAME.w}×${LEGACY_FRAME.h}가 아니에요` });
      else parts[name] = pixels;
    }
    const legacy: LegacyDraft = { ...identity, parts, order: Object.keys(parts) };
    return { draft: fromLegacyDraft(legacy), dropped };
  }

  const { w, h } = pack.frame;
  const sized = (name: string): Pixels | undefined => {
    const px = pictures.get(name);
    if (!px) return undefined;
    if (px.w !== w || px.h !== h) {
      dropped.push({ name, reason: `그림 크기가 ${w}×${h}가 아니에요` });
      used.add(name);
      return undefined;
    }
    used.add(name);
    return px;
  };
  const parts: Part[] = meta.filter((m) => isPartId(m.id)).map((m) => {
    const role = (ROLES as readonly string[]).includes(m.role ?? '') ? (m.role as Role) : undefined;
    const rest = restVariant({ role });
    const pixels = sized(m.id) ?? sized(`${m.id}.${rest}`) ?? blank(w, h);
    const variants = Object.fromEntries(layers.flatMap((l) => {
      if (!l.name.startsWith(`${m.id}.`) || l.name === `${m.id}.${rest}`) return [];
      const v = l.name.slice(m.id.length + 1);
      if (v.includes('.') || meta.some((o) => o.id === l.name)) return [];
      const px = sized(l.name);
      return px ? [[v, px] as const] : [];
    }));
    return { id: m.id, label: m.label, parent: m.parent, pixels, ...(role ? { role } : {}), ...(m.pivot ? { pivot: [...m.pivot] as [number, number] } : {}), ...(Object.keys(variants).length ? { variants } : {}) };
  });
  const faces = new Set(parts.filter((p) => p.variants).map((p) => p.id));
  const expressions = Object.fromEntries(Object.entries(pack.expressions ?? {}).filter(([name]) => !BUILT_IN_FACES.has(name) && !name.includes('@')).map(([name, picks]) => [
    name,
    Object.fromEntries(Object.entries(picks).filter(([id, v]) => faces.has(id) && v !== restVariant(parts.find((p) => p.id === id)!)))
  ]));
  for (const { name } of layers) if (!used.has(name)) dropped.push({ name, reason: '부위에 없는 레이어예요' });
  const draft: CharacterDraft = {
    ...identity,
    canvas: { w, h },
    body: { kind: 'biped', merged: pack.editor?.body?.merged ?? !parts.some((p) => p.role === 'head') },
    parts,
    ...(Object.keys(expressions).length ? { expressions } : {})
  };
  return { draft, dropped };
};
