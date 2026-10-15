import { pixelIcons as sharedIcons, pixelPalette, moodIcons, moodLabels } from '../../../mobile/src/domain/pixelIcons';
import { esc } from './charts';

export { moodIcons, moodLabels };

// Desktop-only icons on top of the shared mobile set (same 8×8 grid and palette).
const desktopIcons = {
  funnel: ['oooooooo', 'obbbbbbo', '.obbbbo.', '..obbo..', '..obbo..', '..obbo..', '..obbo..', '...oo...']
} as const;

export const pixelIcons = { ...sharedIcons, ...desktopIcons };
export type PixelIconName = keyof typeof pixelIcons;

export const pixelIcon = (name: PixelIconName, label?: string) => {
  const pixels = pixelIcons[name].flatMap((row, y) => [...row].map((c, x) =>
    c === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1" fill="${pixelPalette[c as keyof typeof pixelPalette]}"/>`
  )).join('');
  return `<svg class="pixel-icon" width="16" height="16" viewBox="0 0 8 8" shape-rendering="crispEdges" focusable="false" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${pixels}</svg>`;
};
