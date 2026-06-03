export type LayerKind =
  | 'background'
  | 'timeVariant'
  | 'weather'
  | 'lighting'
  | 'roomObjects'
  | 'character'
  | 'fx'
  | 'uiOverlay';

export type SceneLayer = {
  key: string;
  kind: LayerKind;
  label: string;
  zIndex: number;
  mockColor: string;
  opacity: number;
  enabledPhases?: string[];
};
