import { powerMonitor } from 'electron';
import type { WakeReason } from '../../core/scheduler';

// Electron has no "system clock changed" event. These are the moments a
// sleeping timer may have missed time, so the scheduler re-checks its jobs.
export const bridgePower = (wake: (reason: WakeReason) => void) => {
  powerMonitor.on('resume', () => wake('resume'));
  powerMonitor.on('unlock-screen', () => wake('unlock'));
  if (process.platform === 'darwin') powerMonitor.on('user-did-become-active', () => wake('active'));
};
