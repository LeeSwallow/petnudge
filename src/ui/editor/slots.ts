import { STANDARD_SLOTS, type SlotId } from '../../domain/character/standard';

// The standard slots the editor lists (spec: 2026-11-04-character-editor-design
// § 부위 칸), back to front, from the standard pack (src/domain/character/standard.ts).

export { STANDARD_SLOTS as EDITOR_SLOTS, type StandardSlot as EditorSlot, type SlotId } from '../../domain/character/standard';

// The slots as choices for a <select> (#57: 칸에 넣기, a layer's slot): one
// group per slot, one option per layer; `custom:new` is a new decoration.
export const NEW_DECORATION = 'custom:new';
export type LayerChoice = { slot: SlotId; label: string; options: { value: string; label: string }[] };
export const LAYER_CHOICES: readonly LayerChoice[] = STANDARD_SLOTS.map((slot) => ({
  slot: slot.id,
  label: slot.label,
  options:
    slot.id === 'custom'
      ? [{ value: NEW_DECORATION, label: '장식 (새로)' }]
      : slot.parts.map((p) => ({ value: p.name, label: slot.parts.length === 1 ? slot.label : `${slot.label} · ${p.name}` }))
}));
