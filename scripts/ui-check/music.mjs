// 집중 › 플레이리스트 (src/ui/modules/playlist) and the music behind it.
import { check, T, TS } from './lib.mjs';

const CLEAR = `for (const p of await window.petApi.db.listPlaylists()) await window.petApi.db.deletePlaylist(p.id); return true;`;

export default {
  name: 'music',
  covers: ['src/ui/modules/playlist/**', 'src/ui/widgets/music/**', 'src/renderer/music.ts', 'src/shared/music.ts', 'src/shared/playlistQueue.ts', 'src/main/nowPlaying.ts'],
  setup: CLEAR,
  checks: [
    check('music: no lists yet', `await openPanel(); await open_('focus', 'playlist'); return [text('#items'), text('#list-select')];`, [T('music.noListYet'), T('music.noPlaylists')]),
    check('music: new list with Enter', `type('#new-list', '집중 음악'); key('#new-list', 'Enter'); await wait(400); return [$('#new-list').value, text('#list-select'), text('#items'), $$('#focus-list option').map((o) => o.textContent)];`, ['', '집중 음악', T('music.emptyList'), [T('music.noList'), '집중 음악 (0)']]),
    check('music: timer sync is saved', `$('#sync').click(); await wait(300); return $('#sync').checked;`, true),
    check('music: a wrong link is refused', `$('details.external').open = true; type('#link', 'https://example.com'); key('#link', 'Enter'); await wait(200); return text('#playlist-hint');`, T('music.spotifyOnly')),
    check('music: delete the list', `$('[aria-label=' + ${JSON.stringify(JSON.stringify(T('music.deleteList')))} + ']').click(); await wait(400); return text('#items');`, T('music.noListYet'))
  ],
  cleanup: CLEAR
};
