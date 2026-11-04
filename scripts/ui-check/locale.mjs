// The language (#77): Settings › 프로필 › 언어 switches the panel, the dock,
// the bubble and main (diagnostics, the AI tool names) at once, no reload.
import { LOCALE, check, TIn } from './lib.mjs';

const SET = (locale) => `await window.petApi.db.updateSettings({ locale: '${locale}' }); return true;`;
// Picks a language the way the user does: the select in Settings › 프로필.
const choose = (locale) => `const s = $('#language-select'); s.value = '${locale}'; s.dispatchEvent(new Event('change', { bubbles: true })); await wait(500);`;
// What shows in the language now: panel tabs, the dock, the page, the
// settings row, main's diagnostics and the AI tool names main sends.
const READ = `
  const tabs = $$('[data-group]').map((b) => b.textContent.trim());
  const diagnostics = (await window.petApi.diagnostics()).split('\\n')[1];
  $('#ai-open').click(); await wait(300);
  const tool = $('[data-tool=add_todo]')?.closest('label')?.textContent.replace(/\\s+/g, ' ').trim();
  $('[data-action=ai-back]').click(); await wait(200);
  return [tabs, $('#dock').getAttribute('aria-label'), document.documentElement.lang, text('#language-row .field-label'), diagnostics, tool];`;
const expected = (locale) => {
  const recent = TIn(locale, 'dialog.diagnostics.recent', { count: 999 }).split('999')[0];
  return [
    ['home', 'focus', 'record', 'settings'].map((g) => TIn(locale, `panel.group.${g}`)),
    TIn(locale, 'dock.label'),
    locale === 'xx' ? 'en' : locale,
    TIn(locale, 'settings.language'),
    { none: TIn(locale, 'dialog.diagnostics.none'), recent },
    `${TIn(locale, 'tools.add_todo')} ${TIn(locale, 'ai.toolWrites')}`
  ];
};
// the diagnostics line says "none" or starts with the "recent" heading
const matchDiagnostics = (locale) => `const e = ${JSON.stringify(expected(locale))}; const got = await (async () => { ${READ} })(); const line = got[4]; got[4] = line === e[4].none || line.startsWith(e[4].recent) ? e[4] : line; return got;`;

export default {
  name: 'locale',
  covers: ['src/i18n/**', 'src/ui/i18n.ts', 'src/renderer/data.ts', 'src/main/trayMenu.ts', 'src/main/logIpc.ts', 'scripts/ui-check/lib.mjs'],
  setup: SET(LOCALE),
  checks: [
    check('locale: the language row lists the three languages, the active one chosen', `await openPanel(); await open_('settings', 'settings'); await wait(300); return [$$('#language-select option').map((o) => o.value + ':' + o.textContent), $('#language-select').value];`,
      [['ko:한국어', 'en:English', 'ja:日本語'], LOCALE === 'xx' ? 'ko' : LOCALE]),
    ...['en', 'ja', 'ko'].map((locale) =>
      check(`locale: choosing ${locale} switches the panel, the dock, the page and main`, `${choose(locale)} ${matchDiagnostics(locale)}`, expected(locale))),
    check('locale: the choice is saved and survives a reload', `return (await window.petApi.db.getSettings()).locale;`, 'ko'),
    check('locale: after a reload the panel still speaks it', `await openPanel(); await open_('settings', 'settings'); return $$('[data-group]').map((b) => b.textContent.trim());`,
      ['home', 'focus', 'record', 'settings'].map((g) => TIn('ko', `panel.group.${g}`)), { reload: true }),
    check('locale: the bubble speaks it once the panel closes', `${choose('en')} $('#pet').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); await wait(1500); return [$('#panel').hidden, $('#bubble').textContent.trim().length > 0, /[가-힣]/.test($('#bubble').textContent)];`, [true, true, false])
  ],
  cleanup: SET(LOCALE)
};
