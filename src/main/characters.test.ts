import { readFileSync, readdirSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCharacterLibrary } from './characters';

describe('character library', () => {
  it('imports a Pixelorama (.pxo) pack and lists it as editable', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'chars-'));
    const noBuiltins = await mkdtemp(path.join(os.tmpdir(), 'builtin-'));
    const library = createCharacterLibrary(root, noBuiltins);
    const id = await library.importFolder(path.resolve('assets/characters/moa'));
    expect(id).toBe('moa');
    expect(await library.list()).toEqual([{ id: 'moa', name: '모아', persona: expect.stringContaining('츤데레'), builtin: false, editable: true }]);
    expect((await library.prepareSource('moa')).source).toMatch(/moa\.pxo$/);
  }, 30_000);

  it('lists every built-in character folder', async () => {
    const library = createCharacterLibrary(await mkdtemp(path.join(os.tmpdir(), 'chars-')), path.resolve('assets/characters'), { editBuiltinInPlace: true });
    // Every @2 pack folder (the old @1 miso is skipped), whatever gets added.
    const expected = readdirSync('assets/characters').filter((d) => {
      try { return JSON.parse(readFileSync(`assets/characters/${d}/character.json`, 'utf8')).format === 'study-pet-character@2'; } catch { return false; }
    }).sort();
    expect((await library.list()).map((c) => c.id).sort()).toEqual(expected);
    expect(expected).toEqual(expect.arrayContaining(['lila', 'moa']));
  });
});
