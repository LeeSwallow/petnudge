// Layer names in the .aseprite are the cell names the app draws:
//
//   <layer>[.<variant>][@<head>][#<pose>]
//
//   hair.front            a body part (pack layer "hair.front")
//   hair.front@turnL      the same part on a head turned left
//   outer.jacket          slot "outer", variant "jacket"
//   outer.jacket#stretch  that variant in the stretch pose
//   eye.L.smile           face layer "eye.L", variant "smile"
//   socket.L.open         mask cell (a layer's `clip`), never drawn itself
//   pose.stretch          a whole-body pose drawing (pack `poses`)
//
// Groups in the .aseprite are only for tidiness; the exporter ignores them.

export const NAME = /^[a-zA-Z][a-zA-Z0-9._-]*(@[a-zA-Z0-9_-]+)?(#[a-zA-Z0-9_-]+)?$/;

// "eye.L.smile@turnR" → { base: "eye.L.smile", head: "turnR", pose: undefined }
export const splitSuffix = (name) => {
  const [rest, pose] = name.split('#');
  const [base, head] = rest.split('@');
  return { base, head, pose };
};

// Which pack layer (or clip mask) a base name belongs to, and its variant.
// Longest id wins, so "eye.L.smile" is layer "eye.L", variant "smile".
export const ownerOf = (pack, base) => {
  const ids = [...pack.layers.map((l) => l.id), ...pack.layers.filter((l) => l.clip).map((l) => l.clip)];
  const id = ids.filter((i) => base === i || base.startsWith(`${i}.`)).sort((a, b) => b.length - a.length)[0];
  if (!id) return undefined;
  return { id, variant: base === id ? undefined : base.slice(id.length + 1) };
};
