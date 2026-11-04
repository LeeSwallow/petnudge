export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer;
export function decodePng(buf: Uint8Array): { width: number; height: number; rgba: Uint8Array };
