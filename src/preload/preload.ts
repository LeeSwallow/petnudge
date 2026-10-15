import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { Repository, RepositoryMethod } from '../main/db/repository';
import { DB_METHODS } from '../shared/dbMethods';
import type { ExternalPlayer, NowPlaying } from '../shared/music';
import type { CharacterAsset, CharacterChoice } from '../shared/characterImport';
import type { ModInfo, ModProblem } from '../shared/mods';
import type { BackupSummary } from '../main/backup';
import type { ChatEvent, ChatProvider, ChatProviderInfo, ChatRequest, ChatToolInfo, PetCommand } from '../shared/chat';

type AsyncRepository = {
  [K in RepositoryMethod]: (...args: Parameters<Repository[K]>) => Promise<ReturnType<Repository[K]>>;
};

// One function per repository method over the single `db` IPC channel:
// petApi.db.listTodos() etc. (contextBridge only copies own keys, so no Proxy.)
const db = Object.fromEntries(
  DB_METHODS.map((method) => [method, (...args: unknown[]) => ipcRenderer.invoke('db', method, ...args)])
) as AsyncRepository;

const petApi = {
  listCharacters: (): Promise<CharacterChoice[]> => ipcRenderer.invoke('characters:list'),
  getCharacter: (id: string): Promise<CharacterAsset> => ipcRenderer.invoke('characters:get', id),
  importCharacter: (): Promise<string | null> => ipcRenderer.invoke('characters:import'),
  editCharacter: (id: string): Promise<void> => ipcRenderer.invoke('characters:edit', id),
  rebuildCharacter: (id: string): Promise<CharacterAsset> => ipcRenderer.invoke('characters:rebuild', id),
  cloneCharacter: (from: string, name: string): Promise<string> => ipcRenderer.invoke('characters:clone', from, name),
  onCharacterError: (listener: (id: string, message: string) => void) => {
    ipcRenderer.on('characters:error', (_event, id: string, message: string) => listener(id, message));
  },
  chatProviders: (refresh = false): Promise<ChatProviderInfo[]> => ipcRenderer.invoke('chat:providers', refresh),
  // provider: omit to use the one chosen in Settings › AI 대화.
  sendChat: (id: string, request: ChatRequest, provider?: ChatProvider): Promise<string> => ipcRenderer.invoke('chat:send', id, request, provider),
  cancelChat: (id: string) => ipcRenderer.send('chat:cancel', id),
  onChatEvent: (listener: (id: string, event: ChatEvent) => void) => {
    ipcRenderer.on('chat:event', (_event, id, chatEvent) => listener(id, chatEvent));
  },
  chatTools: (): Promise<ChatToolInfo[]> => ipcRenderer.invoke('chat:tools'),
  setChatKey: (provider: ChatProvider, key: string): Promise<void> => ipcRenderer.invoke('chat:set-key', provider, key),
  onPetCommand: (listener: (command: PetCommand) => void) => {
    ipcRenderer.on('pet-command', (_event, command) => listener(command));
  },
  listMods: (): Promise<{ mods: ModInfo[]; problems: ModProblem[] }> => ipcRenderer.invoke('mods:list'),
  createMod: (): Promise<string> => ipcRenderer.invoke('mods:create'),
  openMod: (file: string): Promise<void> => ipcRenderer.invoke('mods:open', file),
  setModEnabled: (id: string, enabled: boolean): Promise<void> => ipcRenderer.invoke('mods:toggle', id, enabled),
  onModsChanged: (listener: () => void) => {
    ipcRenderer.on('mods:changed', () => listener());
  },
  // A character was re-exported (dev: npm run watch:character).
  onCharacterChanged: (listener: (id: string) => void) => {
    ipcRenderer.on('characters:changed', (_event, id: string) => listener(id));
  },
  db,
  setIgnoreMouse: (ignore: boolean) => ipcRenderer.send('set-ignore-mouse', ignore),
  moveBy: (dx: number, dy: number) => ipcRenderer.send('move-by', dx, dy),
  walkStep: (dx: number, dy = 0): Promise<{ left: number; right: number; up: number; down: number }> => ipcRenderer.invoke('walk-step', dx, dy),
  resetPosition: () => ipcRenderer.send('reset-position'),
  reportPetLayout: (size: { petAreaHeight: number; petWidth: number }) => ipcRenderer.send('pet-layout', size),
  setPanelOpen: (open: boolean) => ipcRenderer.send('panel-open', open),
  onLayout: (listener: (layout: { below: boolean; petDx: number; panelHeight: number }) => void) => {
    ipcRenderer.on('layout', (_event, layout) => listener(layout));
  },
  getCursor: (): Promise<{ x: number; y: number } | null> => ipcRenderer.invoke('cursor'),
  controlMusic: (player: ExternalPlayer, action: 'play' | 'pause' | 'next') => ipcRenderer.invoke('music-control', player, action),
  playItem: (player: ExternalPlayer, ref: string) => ipcRenderer.invoke('music-play-item', player, ref),
  pickAudioFiles: (): Promise<string[]> => ipcRenderer.invoke('pick-audio-files'),
  // Absolute path of a dropped file (sandboxed renderers can't read File.path).
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  onNowPlaying: (listener: (nowPlaying: NowPlaying | null) => void) => {
    ipcRenderer.on('now-playing', (_event, nowPlaying: NowPlaying | null) => listener(nowPlaying));
  },
  getMcpInfo: (): Promise<{ url: string; token: string } | null> => ipcRenderer.invoke('mcp-info'),
  // Backup: main shows the file dialogs. importData only validates and
  // previews; confirmImport then overwrites everything.
  exportData: (): Promise<(BackupSummary & { file: string }) | null> => ipcRenderer.invoke('data:export'),
  importData: (): Promise<(BackupSummary & { file: string }) | null> => ipcRenderer.invoke('data:import', 'pick'),
  confirmImport: (): Promise<{ session: string | null }> => ipcRenderer.invoke('data:import', 'apply'),
  cancelImport: (): Promise<null> => ipcRenderer.invoke('data:import', 'cancel'),
  onTimerCommand: (listener: (command: 'start' | 'stop' | 'pause' | 'resume') => void) => {
    ipcRenderer.on('mcp-timer', (_event, command) => listener(command));
  },
  onDataChanged: (listener: (kind: 'todos' | 'notes' | 'stats' | 'settings') => void) => {
    ipcRenderer.on('data-changed', (_event, kind) => listener(kind));
  },
  // Friend pets (main/friends.ts). In a friend window `friendId` is its character.
  friendId: new URLSearchParams(location.search).get('friend'),
  listFriends: (): Promise<string[]> => ipcRenderer.invoke('friends:list'),
  openFriend: (id: string): Promise<void> => ipcRenderer.invoke('friends:open', id),
  closeFriend: (id?: string) => ipcRenderer.send('friends:close', id),
  friendSay: (id: string, text: string, ms = 6000) => ipcRenderer.send('friends:say', id, text, ms),
  friendHold: (id: string, ms: number, faceDx: number) => ipcRenderer.send('friends:hold', id, ms, faceDx),
  onFriends: (listener: (ids: string[]) => void) => {
    ipcRenderer.on('friends:list', (_event, ids) => listener(ids));
  },
  onFriendNear: (listener: (info: { id: string; near: boolean; dx: number; since: number }) => void) => {
    ipcRenderer.on('friend-near', (_event, info) => listener(info));
  },
  onFriendSay: (listener: (text: string, ms: number) => void) => {
    ipcRenderer.on('friend-say', (_event, text, ms) => listener(text, ms));
  },
  onFriendHold: (listener: (ms: number, faceDx: number) => void) => {
    ipcRenderer.on('friend-hold', (_event, ms, faceDx) => listener(ms, faceDx));
  },
  quit: () => ipcRenderer.send('quit')
};

export type PetApi = typeof petApi;

contextBridge.exposeInMainWorld('petApi', petApi);
