// The app log and 진단 정보 (main/logIpc.ts, infra/logger.ts) under 설정.
import { check } from './lib.mjs';

export default {
  name: 'logs',
  covers: ['src/main/logIpc.ts', 'src/infra/logger.ts', 'src/ui/log.ts', 'src/ui/modules/settings/Settings.svelte'],
  checks: [
    check('settings: troubleshooting buttons', `await openPanel(); await open_('settings', 'settings'); return [$('#open-logs') !== null, text('#copy-diagnostics')];`, [true, '진단 정보 복사']),
    check('diagnostics: versions, no secrets', `window.petApi.log('error', 'check', 'token Bearer abcdefghijklmnopqrstuvwxyz0123 sk-ant-abcdefghij12345'); await wait(300); const d = await window.petApi.diagnostics(); return [d.startsWith('petnudge '), d.includes('ERROR [check]'), /Bearer [A-Za-z0-9]{8}|sk-ant-/.test(d)];`, [true, true, false])
  ]
};
