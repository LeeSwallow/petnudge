export function findAseprite(): string;
export function inspect(source: string): Promise<{ width: number; height: number; frames: number; layers: { name: string; group: string; visible: boolean; empty: boolean }[] }>;
export function exportSheet(source: string, dir: string): Promise<{ sheet: string; frames: Record<string, { x: number; y: number; w: number; h: number }> }>;
