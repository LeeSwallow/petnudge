// 집중 › 플레이리스트 (src/ui/modules/playlist) and the music behind it.
import { check } from './lib.mjs';

const CLEAR = `for (const p of await window.petApi.db.listPlaylists()) await window.petApi.db.deletePlaylist(p.id); return true;`;

export default {
  name: 'music',
  covers: ['src/ui/modules/playlist/**', 'src/ui/widgets/music/**', 'src/renderer/music.ts', 'src/shared/music.ts', 'src/shared/playlistQueue.ts', 'src/main/nowPlaying.ts'],
  setup: CLEAR,
  checks: [
    check('music: no lists yet', `await openPanel(); await open_('focus', 'playlist'); return [text('#items'), text('#list-select')];`, ['위에서 새 플레이리스트를 만들어보세요', '플레이리스트 없음']),
    check('music: new list with Enter', `type('#new-list', '집중 음악'); key('#new-list', 'Enter'); await wait(400); return [$('#new-list').value, text('#list-select'), text('#items'), $$('#focus-list option').map((o) => o.textContent)];`, ['', '집중 음악', '곡을 추가해보세요', ['(없음 · 이어서 재생/일시정지)', '집중 음악 (0)']]),
    check('music: timer sync is saved', `$('#sync').click(); await wait(300); return $('#sync').checked;`, true),
    check('music: a wrong link is refused', `$('details.external').open = true; type('#link', 'https://example.com'); key('#link', 'Enter'); await wait(200); return text('#playlist-hint');`, 'Spotify 트랙/앨범/플레이리스트 링크만 지원해요'),
    check('music: delete the list', `$('[aria-label="목록 삭제"]').click(); await wait(400); return text('#items');`, '위에서 새 플레이리스트를 만들어보세요')
  ],
  cleanup: CLEAR
};
