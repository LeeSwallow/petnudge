import { ipcMain, shell } from 'electron';
import { externalUrl } from '../../domain/links/link';

// A link in a chat reply, opened in the external browser after the user said
// yes in the panel. The address comes from the renderer, so it is checked
// again here: only http and https ever reach the system.

export const openLink = async (raw: unknown, open: (url: string) => Promise<void>): Promise<boolean> => {
  const url = externalUrl(raw);
  if (!url) return false;
  await open(url);
  return true;
};

export const installLinks = () => {
  ipcMain.handle('link:open', (_event, raw: unknown) => openLink(raw, (url) => shell.openExternal(url)));
};
