// Checks the layer list against the pack. Errors stop the export; warnings
// are printed (names the pack never uses, extra frames). An empty layer is a
// valid cell: `nose.open@turnR` left empty means "no nose on that head".
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

  const poses = new Set(Object.values(pack.poses ?? {}).map(poseCell));
  const unused = Object.keys(cells).filter((name) => !poses.has(name) && !ownerOf(pack, splitSuffix(name).base));
  if (unused.length) warnings.push(`팩에서 쓰지 않는 레이어예요 (이름 오타인지 확인해주세요): ${unused.join(', ')}`);
  return { errors, warnings: [...new Set(warnings)] };
};
