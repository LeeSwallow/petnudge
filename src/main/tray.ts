import { Menu, Tray, nativeImage } from 'electron';
import path from 'node:path';
import { trayMenuItems, type TrayAction } from './trayMenu';

// The tray (macOS menu bar) icon and its menu (trayMenu.ts). The menu is
// rebuilt when what it shows changes: the panel opening, the chat shortcut.
export const createTray = (options: {
  iconDir: string;
  state: () => { panelOpen: boolean; chatShortcut: boolean };
  run: (action: TrayAction) => void;
}) => {
  const mac = process.platform === 'darwin';
  const icon = nativeImage.createFromPath(path.join(options.iconDir, mac ? 'trayTemplate.png' : 'tray.png'));
  if (mac) icon.setTemplateImage(true);
  const tray = new Tray(icon);
  tray.setToolTip('petnudge');

  const refresh = () => {
    tray.setContextMenu(Menu.buildFromTemplate(trayMenuItems(options.state()).map((item) =>
      item.type === 'separator'
        ? { type: 'separator' as const }
        // The keys are shown only; globalShortcut in main.ts owns them.
        : { label: item.label, accelerator: item.accelerator, registerAccelerator: false, click: () => options.run(item.action) }
    )));
  };
  // Windows opens a tray menu on right click only; a left click opens it too.
  if (process.platform === 'win32') tray.on('click', () => tray.popUpContextMenu());
  refresh();
  return { refresh, destroy: () => tray.destroy() };
};
