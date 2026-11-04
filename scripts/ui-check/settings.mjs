// 설정 › 설정 (src/ui/modules/settings): the settings list and the AI page.
import { check } from './lib.mjs';

const RESET = `await window.petApi.db.updateSettings({ nickname: '' }); return true;`;

export default {
  name: 'settings',
  covers: ['src/ui/modules/settings/**', 'src/shared/settings.ts', 'src/main/backup.ts', 'src/main/characters.ts', 'src/main/mods.ts', 'src/main/mcp.ts', 'src/shared/mods.ts', 'src/shared/chat.ts', 'src/main/chat*.ts', 'src/renderer/character.ts', 'src/renderer/character/**'],
  setup: RESET,
  checks: [
    check('settings: steppers change and save', `await openPanel(); await open_('settings', 'settings'); await wait(300); const before = text('#out-focusMinutes'); $('#out-focusMinutes').nextElementSibling.click(); await wait(400); const after = text('#out-focusMinutes'); $('#out-focusMinutes').previousElementSibling.click(); await wait(400); return [before, after, text('#out-focusMinutes'), text('#out-petScale')];`, ['25분', '30분', '25분', '2배']),
    check('settings: a toggle saves', `const box = $('[data-bool=autoStartFocus]'); const was = box.checked; box.click(); await wait(400); const now = box.checked; box.click(); await wait(400); return [now === !was, box.checked === was];`, [true, true]),
    check('settings: chat shortcut toggle is under 펫 and off', `const box = $('[data-bool=chatShortcut]'); const group = box?.closest('.setting-group')?.previousElementSibling; return [box !== null, group?.textContent.trim(), box?.checked, (await window.petApi.db.getSettings()).chatShortcut];`, [true, '펫', false, false]),
    check('settings: chat shortcut toggle saves', `const box = $('[data-bool=chatShortcut]'); box.click(); await wait(400); const on = [box.checked, (await window.petApi.db.getSettings()).chatShortcut]; box.click(); await wait(400); return [on, box.checked, (await window.petApi.db.getSettings()).chatShortcut];`, [[true, true], false, false]),
    check('settings: character list and dress-up', `return [$$('#character-select option').length >= 3, $('#character-select').value, $$('#dressup .slot-row').length > 0];`, [true, 'lila', true]),
    check('settings: every outfit can be chosen (no unlocks)', `return [$$('#dressup .swatch').length > 0, $$('#dressup .swatch[disabled]').length, text('#dressup').includes('잠김')];`, [true, 0, false]),
    check('settings: nickname saves', `type('#nickname', '민'); $('#nickname').dispatchEvent(new Event('change', { bubbles: true })); await wait(400); return $('#nickname').value;`, '민'),
    check('settings: backup and MCP sections', `await wait(500); return [$$('#backup-box button').length, text('#mcp-box').includes('Claude Code')];`, [2, true]),
    check('settings: AI page opens over the list and goes back', `$('#ai-open').click(); await wait(400); const open = [!$('#ai-page').hidden, getComputedStyle($('#nickname')).display === 'none' || $('#nickname').offsetParent === null]; $('#ai-page [data-action=ai-back]').click(); await wait(300); return [open, $('#ai-page').hidden];`, [[true, true], true]),
    check('settings: backup buttons, no confirm step yet', `return [$$('#backup-box > .row button').map((b) => b.textContent.trim() + (b.disabled ? '!' : '')), $('#backup-confirm').hidden, $$('#backup-confirm button').length, text('#backup-status').startsWith('할 일·메모')];`, [['내보내기(JSON)', '가져오기(JSON)'], true, 0, true]),
    check('settings: AI page lists providers and tools', `$('#ai-open').click(); await wait(500); return [$$('#ai-providers .ai-provider').length, $$('#ai-providers .ai-provider.selected').length, $$('#ai-providers input[name=ai-provider]:checked').length, $$('#ai-tool-list .ai-tool').length > 0];`, [6, 1, 1, true]),
    check('settings: AI profile fields save', `const c = $('#ai-call'); c.value = '선생님'; c.dispatchEvent(new Event('change', { bubbles: true })); await wait(300); const long = $('[data-length=long]'); long.click(); await wait(300); const saved = [text('#ai-preview').includes('선생님'), long.getAttribute('aria-pressed'), $('[data-length=short]').getAttribute('aria-pressed')]; $('[data-action=profile-reset]').click(); await wait(300); return [saved, $('#ai-call').value, $('[data-length=short]').getAttribute('aria-pressed')];`, [[true, 'true', 'false'], '', 'true']),
    check('settings: clearing every conversation asks first', `const b = $('#ai-clear'); const before = text('#ai-sessions'); b.click(); await wait(100); const asked = [b.textContent, text('#ai-sessions') === before]; b.click(); await wait(300); return [asked, b.textContent, text('#ai-sessions')];`, [['정말 모두 지울까요?', true], '모든 대화 지우기', '저장된 대화 0개']),
    check('settings: AI page back returns to the list', `$('#ai-page [data-action=ai-back]').click(); await wait(300); return [$('#ai-page').hidden, $('#nickname').offsetParent !== null];`, [true, true]),
    check('settings: quit button under settings', `await open_('settings'); return $('[data-quit]') !== null;`, true)
  ],
  cleanup: RESET
};
