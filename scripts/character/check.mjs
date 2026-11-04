// Checks the layer list against the pack. Errors stop the export; warnings
// are printed (names the pack never uses, extra frames). An empty layer is a
// valid cell: `nose.open@turnR` left empty means "no nose on that head".
import { poseDrawable, selectableOutfits } from '../../src/domain/character/outfits.ts';
import { NAME, ownerOf, splitSuffix } from './names.mjs';

const hasFace = (pack, cells, face) => face === 'open' || Boolean(pack.expressions ? pack.expressions[face] : cells[`face.${face}`]);

// Before export: names, duplicates, canvas.
export const checkLayers = (pack, info) => {
  const errors = [], warnings = [];
  if (info.width !== pack.frame.w || info.height !== pack.frame.h) errors.push(`캔버스가 ${info.width}×${info.height}이에요. 팩은 ${pack.frame.w}×${pack.frame.h}예요`);
  if (info.frames > 1) warnings.push(`프레임이 ${info.frames}개예요. 첫 프레임만 내보내요`);
  const seen = new Map();
  for (const { name, group } of info.layers) {
    const where = group ? `${group}/${name}` : name;
    if (!NAME.test(name)) errors.push(`레이어 이름 "${where}": 영문·숫자·점(.)으로 쓰고 @방향, #자세는 끝에 붙여주세요`);
    if (seen.has(name)) errors.push(`레이어 이름이 겹쳐요: ${seen.get(name)}, ${where}`);
    seen.set(name, where);
  }
  return { errors, warnings };
};

// After export: everything the pack draws must exist; layers it never uses are reported.
export const checkPack = (pack, cells) => {
  const errors = [], warnings = [];
  for (const layer of pack.layers) {
    if (!layer.from && !cells[layer.id]) errors.push(`부위 레이어가 없어요: ${layer.id}`);
    if (layer.from === 'slot') for (const id of Object.keys(pack.slots[layer.id].variants)) {
      if (id !== 'none' && !cells[`${layer.id}.${id}`]) errors.push(`의상 레이어가 없어요: ${layer.id}.${id}`);
    }
  }
  for (const [name, expression] of Object.entries(pack.expressions ?? {})) {
    const head = name.split('@')[1];
    for (const [layer, variant] of Object.entries(expression)) {
      const cell = `${layer}.${variant}`;
      if (variant !== 'none' && variant !== 'open' && !cells[cell] && !(head && cells[`${cell}@${head}`])) errors.push(`표정 "${name}"에 필요한 레이어가 없어요: ${cell}`);
    }
  }
  const poseCell = (def) => (typeof def === 'string' ? def : def.cell);
  for (const [pose, def] of Object.entries(pack.poses ?? {})) if (!cells[poseCell(def)]) errors.push(`자세 "${pose}" 레이어가 없어요: ${poseCell(def)}`);
  for (const [name, state] of Object.entries(pack.states)) for (const f of [state, ...(state.start ?? []), ...state.loop]) {
    if (f.face && !hasFace(pack, cells, f.face)) errors.push(`동작 "${name}"의 표정이 없어요: ${f.face}`);
  }
  if (Object.values(pack.states).some((s) => s.blink) && !hasFace(pack, cells, 'closed')) errors.push('눈 깜빡임에 쓸 closed 표정이 없어요');

  // Every outfit the settings let her wear must draw in every pose (#50).
  const usedIn = (pose) => Object.entries(pack.states).filter(([, s]) => [...(s.start ?? []), ...s.loop].some((f) => f.pose === pose)).map(([name]) => name);
  for (const outfit of selectableOutfits(pack)) {
    const missing = Object.keys(pack.poses ?? {}).filter((pose) => !poseDrawable(pack, cells, outfit, pose));
    if (!missing.length) continue;
    const states = [...new Set(missing.flatMap(usedIn))];
    const combo = Object.entries(outfit).map(([slot, id]) => `${slot}.${id}`).join(' + ');
    warnings.push(`의상 조합 ${combo}: 그릴 수 없는 자세 ${missing.join(', ')}${states.length ? ` (동작 ${states.join(', ')})` : ''}`);
  }

  const poses = new Set(Object.values(pack.poses ?? {}).flatMap((def) => [poseCell(def), ...(typeof def === 'object' ? def.outfits ?? [] : []).map((o) => o.cell)]));
  const unused = Object.keys(cells).filter((name) => !poses.has(name) && !ownerOf(pack, splitSuffix(name).base));
  if (unused.length) warnings.push(`팩에서 쓰지 않는 레이어예요 (이름 오타인지 확인해주세요): ${unused.join(', ')}`);
  return { errors, warnings: [...new Set(warnings)] };
};

// ---------- pixels (#66) ----------
// `pictures`: Map of cell name → { w, h, data: Uint32Array } (ImageData byte order).

const hexOf = (p) => `#${[p & 0xff, (p >>> 8) & 0xff, (p >>> 16) & 0xff].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const pixelOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return ((0xff << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
};
const distance = (a, b) => Math.hypot((a & 0xff) - (b & 0xff), ((a >>> 8) & 0xff) - ((b >>> 8) & 0xff), ((a >>> 16) & 0xff) - ((b >>> 16) & 0xff));
const luma = (p) => (0.299 * (p & 0xff) + 0.587 * ((p >>> 8) & 0xff) + 0.114 * ((p >>> 16) & 0xff)) / 255;
const opaque = (p) => p >>> 24 !== 0;
const coloursOf = (px, into) => {
  for (const p of px.data) if (opaque(p)) into.add(p >>> 0);
  return into;
};

// Whole poses (Lila's side-view walk, a flail) are drawn apart from the
// standing layers, so their colours drift: a paler skin, another headset
// (#66). Every colour a pose drawing uses should be one the standing character
// uses, a whole drawing or a part drawn for a pose (`hair.back#walk1`; a hood
// drawn with the fringe in it holds hair colours too). The pack's rim colours
// are allowed.
// → [{ cell, colour, count, nearest }]
export const poseColourMismatches = (pack, pictures) => {
  const poses = new Set(Object.keys(pack.poses ?? {}));
  const masks = new Set(pack.layers.filter((l) => l.clip).map((l) => l.clip));
  const whole = new Set(Object.values(pack.poses ?? {}).flatMap((def) => (typeof def === 'string' ? [def] : [def.cell, ...(def.outfits ?? []).map((o) => o.cell)])));
  const all = new Set();
  for (const [name, px] of pictures) {
    if (whole.has(name) || name.includes('#')) continue;
    const owner = ownerOf(pack, splitSuffix(name).base);
    if (owner && !masks.has(owner.id)) coloursOf(px, all);
  }
  const allowed = new Set(pack.layers.flatMap((l) => (l.edge ? [l.edge.color, l.edge.light] : [])).filter(Boolean).map(pixelOf));
  const out = [];
  for (const [name, px] of pictures) {
    const { pose } = splitSuffix(name);
    if (!whole.has(name) && !(pose && poses.has(pose))) continue;
    const palette = all;
    if (!palette.size) continue;
    const counts = new Map();
    for (const p of px.data) if (opaque(p) && !palette.has(p >>> 0) && !allowed.has(p >>> 0)) counts.set(p >>> 0, (counts.get(p >>> 0) ?? 0) + 1);
    const nearest = (p) => [...palette].reduce((best, q) => (distance(p, q) < distance(p, best) ? q : best));
    for (const [p, count] of [...counts].sort((a, b) => b[1] - a[1])) out.push({ cell: name, colour: hexOf(p), count, nearest: hexOf(nearest(p)) });
  }
  return out;
};

// An iris is drawn clipped to its socket mask and moves a pixel when she
// glances, so it must be whole: pixels outside the mask are cut off (a
// highlight there never shows), and holes inside it show the eye layer, which
// stays put while the iris moves (#66). A hole is a pixel the visible iris
// (iris and mask both drawn) leaves out, with visible iris on both sides of it
// in its row: a gap in the iris or in its mask.
// → [{ cell, mask, outside, outsideHighlights, holes }]
export const irisProblems = (pack, pictures) => {
  const out = [];
  for (const layer of pack.layers.filter((l) => l.clip)) {
    for (const [name, iris] of pictures) {
      const { base, head, pose } = splitSuffix(name);
      if (pose || !base.startsWith(`${layer.id}.`)) continue;
      const maskName = `${layer.clip}.${base.slice(layer.id.length + 1)}${head ? `@${head}` : ''}`;
      const mask = pictures.get(maskName);
      if (!mask) continue;
      const { w, h, data } = iris;
      const on = (x, y) => opaque(data[y * w + x]) && opaque(mask.data[y * w + x]);
      const either = (from, to, step, at) => {
        for (let k = from; k >= 0 && k < to; k += step) if (at(k)) return true;
        return false;
      };
      let outside = 0, outsideHighlights = 0, holes = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (opaque(data[i]) && !opaque(mask.data[i])) {
          outside++;
          if (luma(data[i]) >= 0.85) outsideHighlights++;
        }
        if (on(x, y)) continue;
        const across = either(x - 1, w, -1, (k) => on(k, y)) && either(x + 1, w, 1, (k) => on(k, y));
        if (across) holes++;
      }
      if (outside || holes) out.push({ cell: name, mask: maskName, outside, outsideHighlights, holes });
    }
  }
  return out;
};

// After export, with the cells' pixels: warnings only (an imported pack still loads).
export const checkPixels = (pack, pictures) => {
  const warnings = [];
  const byCell = new Map();
  for (const m of poseColourMismatches(pack, pictures)) byCell.set(m.cell, [...(byCell.get(m.cell) ?? []), m]);
  for (const [cell, list] of byCell) {
    const shown = list.slice(0, 6).map((m) => `${m.colour} ${m.count}px→${m.nearest}`).join(', ');
    warnings.push(`자세 그림 ${cell}: 서 있을 때 쓰지 않는 색 ${list.length}개 (${shown}${list.length > 6 ? ', …' : ''}). 서 있을 때의 색으로 칠해주세요`);
  }
  for (const p of irisProblems(pack, pictures)) {
    const parts = [];
    if (p.outside) parts.push(`${p.mask} 밖 픽셀 ${p.outside}개${p.outsideHighlights ? ` (하이라이트 ${p.outsideHighlights}개)` : ''}`);
    if (p.holes) parts.push(`안쪽 구멍 ${p.holes}개`);
    warnings.push(`홍채 ${p.cell}: ${parts.join(', ')}. 홍채는 하이라이트까지 한 레이어에 빈틈없이 마스크 안에 그려주세요`);
  }
  return { errors: [], warnings };
};
