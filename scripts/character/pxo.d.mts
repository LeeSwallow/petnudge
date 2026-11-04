export type PxoLayer = { name: string; group: string; visible: boolean; empty?: boolean; rgba: Uint8Array };
export function readPxo(file: string): Promise<{ width: number; height: number; frames: number; layers: PxoLayer[] }>;
export function writePxo(file: string, image: { width: number; height: number; layers: { name: string; group: string; visible?: boolean; rgba: Uint8Array }[] }): Promise<void>;
