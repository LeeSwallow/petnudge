import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() }, shell: { openExternal: vi.fn() } }));
const { openLink } = await import('./links');

describe('opening a chat link', () => {
  it('opens http and https addresses', async () => {
    const open = vi.fn(async () => {});
    expect(await openLink('https://example.com/a', open)).toBe(true);
    expect(open).toHaveBeenCalledWith('https://example.com/a');
  });

  it('never passes another scheme to the system', async () => {
    const open = vi.fn(async () => {});
    for (const url of ['javascript:alert(1)', 'file:///Applications/Calculator.app', 'smb://host/share', 'data:text/html,x', 42, null]) {
      expect(await openLink(url, open)).toBe(false);
    }
    expect(open).not.toHaveBeenCalled();
  });
});
