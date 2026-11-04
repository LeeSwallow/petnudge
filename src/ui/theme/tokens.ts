// The design system: colours, type, space, strokes, shadows and motion, as
// CSS variables. Colours are the panel's existing ones, unchanged; each is
// exported both as --color-<name> and under its old name (--ink, --panel…)
// so the older CSS in src/renderer keeps working while modules move here.
// Pixel rules: no rounded corners, no blur, hard offset shadows only.

export const COLOR = {
  ink: '#f4edff',
  'ink-2': '#c9c0e6',
  muted: '#8f86ad',
  panel: '#2a1d33',
  well: '#17142c',
  edge: '#6d5aa8',
  'edge-hi': '#9886d6',
  shadow: '#0b0918',
  focus: '#ffb86b',
  break: '#8fc7ff',
  long: '#ff6fae',
  goal: '#f7f26b',
  'heat-0': '#231a35',
  'heat-1': '#4a3249',
  'heat-2': '#7d4b46',
  'heat-3': '#c27a4a',
  'heat-4': '#ffb86b'
} as const;

// Galmuri is a bitmap face: Galmuri9 reads at 10px, Galmuri11 at 12px, and
// the digits face at whole multiples of 12.
export const FONT = {
  body: "'Galmuri11', ui-monospace, monospace",
  small: "'Galmuri9', 'Galmuri11', ui-monospace, monospace",
  digits: "'GalmuriMono11', 'Galmuri11', ui-monospace, monospace"
} as const;
export const TYPE = { small: 10, body: 12, 'digits-sm': 12, 'digits-md': 24, 'digits-lg': 36 } as const;

export const SPACE = [4, 8, 12, 16, 24, 32] as const;
export const SHADOW = { sm: 2, md: 4 } as const;
export const STROKE = { hair: 1, frame: 2, panel: 3 } as const;
export const MOTION = { fast: 120, base: 200 } as const; // ms

export const toCssVars = (): string => {
  const lines: string[] = [];
  for (const [name, value] of Object.entries(COLOR)) lines.push(`--color-${name}: ${value};`, `--${name}: ${value};`);
  lines.push(`--font: ${FONT.body};`, `--font-small: ${FONT.small};`, `--font-digits: ${FONT.digits};`);
  for (const [name, px] of Object.entries(TYPE)) lines.push(`--type-${name}: ${px}px;`);
  SPACE.forEach((px, i) => lines.push(`--space-${i + 1}: ${px}px;`));
  for (const [name, px] of Object.entries(SHADOW)) lines.push(`--shadow-${name}: ${px}px;`);
  for (const [name, px] of Object.entries(STROKE)) lines.push(`--stroke-${name}: ${px}px;`);
  for (const [name, ms] of Object.entries(MOTION)) lines.push(`--motion-${name}: ${ms}ms;`);
  return `:root{\n${lines.join('\n')}\n}`;
};
