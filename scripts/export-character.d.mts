export function findAseprite(): string;
export function exportCharacter(source: string, manifest: string, outputDir: string, options?: { log?: Pick<Console, 'log' | 'warn'> }): Promise<unknown>;
export function sourceIn(dir: string, id: string, pack?: { source?: string }): string;
