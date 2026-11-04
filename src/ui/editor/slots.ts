// The standard slots the editor lists (spec: 2026-11-04-character-editor-design
// § 부위 칸), back to front. A placeholder until src/domain/character/standard.ts
// lands (#26 A): then this file re-exports from there and nothing else changes.

export type EditorSlot = {
  readonly id: string;
  readonly label: string;
  readonly layers: readonly string[];
  readonly required: boolean;
};

export const EDITOR_SLOTS: readonly EditorSlot[] = [
  { id: 'hair.back', label: '뒷머리', layers: ['hair.back'], required: false },
  { id: 'torso', label: '몸통', layers: ['torso.chest', 'torso.belly'], required: true },
  { id: 'leg', label: '다리', layers: ['leg.L', 'leg.R'], required: false },
  { id: 'arm', label: '팔', layers: ['arm.L', 'arm.R'], required: false },
  { id: 'head', label: '머리(얼굴)', layers: ['head'], required: false },
  { id: 'eye', label: '눈', layers: ['eye.L.open', 'eye.L.closed', 'eye.R.open', 'eye.R.closed'], required: false },
  { id: 'mouth', label: '입', layers: ['mouth.closed', 'mouth.open'], required: false },
  { id: 'hair.front', label: '앞머리', layers: ['hair.front'], required: false },
  { id: 'custom', label: '장식', layers: [], required: false }
];
