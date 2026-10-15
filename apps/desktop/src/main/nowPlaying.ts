import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  EXTERNAL_PLAYERS,
  isValidMusicRef,
  parseNowPlaying,
  pickNowPlaying,
  type ExternalPlayer as PlayerName,
  type NowPlaying
} from '../shared/music';

const run = promisify(execFile);
const isMac = process.platform === 'darwin';

const isRunning = async (player: PlayerName): Promise<boolean> => {
  try {
    await run('pgrep', ['-x', player]);
    return true;
  } catch {
    return false;
  }
};

// `open -Ra` checks that the app exists without launching it or showing the
// "Where is …?" dialog that compiling a `tell application` script would.
const isInstalled = async (player: PlayerName): Promise<boolean> => {
  try {
    await run('open', ['-Ra', player]);
    return true;
  } catch {
    return false;
  }
};

const osascript = (script: string) => run('osascript', ['-e', script], { timeout: 4000 });

const refExpression = (player: PlayerName) => (player === 'Spotify' ? 'id of current track' : 'persistent ID of current track');

const queryScript = (player: PlayerName) => `
tell application "${player}"
  set s to player state as string
  if s is "stopped" then return ""
  return "${player}" & tab & s & tab & (${refExpression(player)}) & tab & (name of current track) & tab & (artist of current track)
end tell`;

// Only query a player that is already running, so polling never launches it.
const queryPlayer = async (player: PlayerName): Promise<NowPlaying | null> => {
  if (!(await isRunning(player))) return null;
  try {
    const { stdout } = await osascript(queryScript(player));
    return parseNowPlaying(stdout);
  } catch {
    // No current track, or Automation permission was denied.
    return null;
  }
};

export const readNowPlaying = async (): Promise<NowPlaying | null> => {
  if (!isMac) return null;
  return pickNowPlaying(await Promise.all(EXTERNAL_PLAYERS.map(queryPlayer)));
};

export const controlPlayer = async (player: PlayerName, action: 'play' | 'pause' | 'next'): Promise<void> => {
  if (!isMac || !(await isRunning(player))) return;
  await osascript(`tell application "${player}" to ${action === 'next' ? 'next track' : action}`);
};

// Starting a playlist item may launch the player, which is what the user asked for.
export const playItem = async (player: PlayerName, ref: string): Promise<void> => {
  if (!isMac || !isValidMusicRef(player, ref) || !(await isInstalled(player))) return;
  if (player === 'Spotify') {
    await osascript(`tell application "Spotify" to play track "${ref}"`);
  } else {
    await osascript(`tell application "Music" to play (first track of library playlist 1 whose persistent ID is "${ref}")`);
  }
};
