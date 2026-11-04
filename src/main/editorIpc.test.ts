import { describe, expect, it, vi } from 'vitest';
import { EDITOR_CHANNEL } from '../domain/character-editor/ipc';
import { editorHandlers, runEditorHandler } from './editorIpc';

const deps = (closeEditor = vi.fn()) => ({
  listCharacters: async () => [
    { id: 'lila', name: '릴라', persona: '명랑', builtin: true, editable: true },
    { id: 'mine', name: '내 펫', builtin: false, editable: false }
  ],
  closeEditor
});

describe('editor IPC', () => {
  it('uses editor:* channels only', () => {
    expect(Object.keys(editorHandlers(deps())).every((channel) => channel.startsWith('editor:'))).toBe(true);
  });

  it('lists characters as id, name and builtin', async () => {
    expect(await editorHandlers(deps())[EDITOR_CHANNEL.listCharacters]()).toEqual({
      ok: true,
      value: [{ id: 'lila', name: '릴라', builtin: true }, { id: 'mine', name: '내 펫', builtin: false }]
    });
  });

  it('closes the editor', async () => {
    const close = vi.fn();
    expect(await editorHandlers(deps(close))[EDITOR_CHANNEL.close]()).toEqual({ ok: true, value: null });
    expect(close).toHaveBeenCalledOnce();
  });

  it('answers not_implemented for import, save and apply', async () => {
    const handlers = editorHandlers(deps());
    for (const channel of [EDITOR_CHANNEL.importImage, EDITOR_CHANNEL.importLayered, EDITOR_CHANNEL.save, EDITOR_CHANNEL.apply]) {
      const result = await handlers[channel]();
      expect(result.ok ? null : result.error.code).toBe('not_implemented');
    }
  });

  it('turns a throw into an internal failure and logs it', async () => {
    const logger = { log: vi.fn() };
    const result = await runEditorHandler('editor:list-characters', () => { throw new Error('disk gone'); }, [], logger);
    expect(result).toEqual({ ok: false, error: { code: 'internal', message: 'disk gone' } });
    expect(logger.log).toHaveBeenCalledWith('error', 'editor', 'editor:list-characters failed: disk gone', expect.any(String));
  });

  it('does not log not_implemented answers', async () => {
    const logger = { log: vi.fn() };
    await runEditorHandler('editor:save', editorHandlers(deps())[EDITOR_CHANNEL.save], [], logger);
    expect(logger.log).not.toHaveBeenCalled();
  });
});
