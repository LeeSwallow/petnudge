// Registers what a new layer name implies, so adding art needs no JSON edit:
//   outer.hoodie           → slot "outer" gets variant "hoodie"
//   eye.L.wink, eye.R.wink → expression "wink" (other face layers stay open,
//                            masked layers like the iris hide unless they have
//                            a "wink" cell too)
//   eye.L.wink@turnL       → expression "wink@turnL" for the turned head
//   head@down + eye.L.open@down → expression "open@down" (a new head direction)
// Existing entries are never changed. Returns what was added, for the log.
import { ownerOf, splitSuffix } from './names.mjs';

export const discover = (pack, names) => {
  const added = [];
  const parsed = names.map((n) => ({ ...splitSuffix(n), owner: ownerOf(pack, splitSuffix(n).base) }));

  for (const layer of pack.layers.filter((l) => l.from === 'slot')) {
    const variants = pack.slots[layer.id].variants;
    for (const { owner } of parsed) {
      if (owner?.id !== layer.id || !owner.variant || variants[owner.variant]) continue;
      variants[owner.variant] = { label: owner.variant };
      added.push(`의상 변형 ${layer.id}.${owner.variant}`);
    }
  }

  if (!pack.expressions) return added;
  const faceLayers = pack.layers.filter((l) => l.from === 'face');
  const faceIds = new Set(faceLayers.map((l) => l.id));
  const cells = new Set(names);
  const found = new Map(); // "<variant>[@head]" → variant
  for (const { owner, head, pose } of parsed) {
    if (!owner || !faceIds.has(owner.id) || !owner.variant || (owner.variant === 'open' && !head) || pose) continue;
    found.set(head ? `${owner.variant}@${head}` : owner.variant, owner.variant);
  }
  for (const [key, variant] of found) {
    if (pack.expressions[key]) continue;
    const head = key.split('@')[1];
    // a turned head only uses art drawn for it (front art sits in the wrong place)
    const has = (id) => cells.has(head ? `${id}.${variant}@${head}` : `${id}.${variant}`);
    const expression = {};
    for (const layer of faceLayers) {
      if (has(layer.id)) expression[layer.id] = variant;
      else if (layer.clip || head) expression[layer.id] = layer.clip ? 'none' : 'open';
    }
    pack.expressions[key] = expression;
    added.push(`표정 ${key}`);
  }
  return added;
};
