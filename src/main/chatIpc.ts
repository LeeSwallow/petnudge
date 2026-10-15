import { ipcMain, safeStorage, type BrowserWindow } from 'electron';
import path from 'node:path';
import { toDateKey } from '../domain/progress/progress';
import { PROVIDER_INFO, isChatProvider, parseChatConfig, parseChatRequest } from '../shared/chat';
import { allowedTools, createChat } from './chat';
import type { Repository } from './db/repository';
import { createPetTools, type ToolBridge } from './petTools';

// Main-process side of the pet chat: settings (kv 'chat.config', written by
// the renderer), API keys (encrypted with the OS keychain via safeStorage and
// never sent back to the renderer), the tool bridge and the chat IPC.

type Deps = {
  userData: string;
  repository: () => Repository;
  win: () => BrowserWindow | null;
  mcp: () => { url: string; token: string } | null;
  listCharacters: () => Promise<{ id: string; name: string }[]>;
  listMods: () => Promise<{ id: string; name: string; enabled: boolean; description?: string }[]>;
  setModEnabled: (id: string, enabled: boolean) => void;
};

const secretKey = (provider: string) => `secret.chat.${provider}`;

export const installChat = (deps: Deps) => {
  const send = (channel: string, ...args: unknown[]) => deps.win()?.webContents.send(channel, ...args);

  // Shared by the chat agent and the MCP server.
  const bridge: ToolBridge = {
    sendTimerCommand: (command) => send('mcp-timer', command),
    notifyChanged: (kind) => send('data-changed', kind),
    todayKey: () => toDateKey(new Date()),
    petCommand: (command) => send('pet-command', command),
    listCharacters: deps.listCharacters,
    listMods: deps.listMods,
    setModEnabled: deps.setModEnabled
  };

  const apiKey = (provider: string): string | null => {
    const stored = deps.repository().getKv(secretKey(provider));
    if (!stored) return null;
    try {
      return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(stored, 'base64')) : null;
    } catch {
      return null;
    }
  };

  const config = () => {
    try { return parseChatConfig(JSON.parse(deps.repository().getKv('chat.config') ?? '{}')); } catch { return parseChatConfig({}); }
  };
  const tools = () => createPetTools(deps.repository(), bridge);

  const chat = createChat({ workDir: path.join(deps.userData, 'chat'), config, tools, mcp: deps.mcp, apiKey });

  ipcMain.handle('chat:providers', (_event, refresh: unknown) => chat.providers(refresh === true));
  ipcMain.handle('chat:tools', () => {
    const cfg = config();
    const allowed = new Set(allowedTools(tools(), cfg).map((t) => t.name));
    return tools().filter((t) => !t.mcpOnly).map((t) => ({ name: t.name, label: t.label, group: t.group, write: t.write, description: t.description, allowed: allowed.has(t.name) }));
  });
  ipcMain.handle('chat:set-key', (_event, provider: unknown, key: unknown) => {
    if (!isChatProvider(provider) || PROVIDER_INFO[provider].kind !== 'api' || typeof key !== 'string' || key.length > 400) throw new Error('잘못된 요청이에요');
    if (!key.trim()) return deps.repository().removeKv(secretKey(provider));
    if (!safeStorage.isEncryptionAvailable()) throw new Error('이 컴퓨터에서는 키를 안전하게 저장할 수 없어요');
    deps.repository().setKv(secretKey(provider), safeStorage.encryptString(key.trim()).toString('base64'));
  });
  ipcMain.handle('chat:send', (event, id: unknown, request: unknown, provider: unknown) => {
    if (typeof id !== 'string' || (provider !== undefined && !isChatProvider(provider))) throw new Error('잘못된 요청이에요');
    return chat.send(id, parseChatRequest(request), (chatEvent) => event.sender.send('chat:event', id, chatEvent), provider);
  });
  ipcMain.on('chat:cancel', (_event, id: unknown) => { if (typeof id === 'string') chat.cancel(id); });

  return { bridge, cancelAll: chat.cancelAll };
};
