import { pixelIcon } from '../icons';
import { api } from '../api';
import { esc } from '../charts';
import { data, refreshNotes } from '../data';
import { enter } from '../fx';
import { createFilter, dayHead, flagToggle, funnelButton } from '../filterBar';
import { dateKeyOf, groupByDay, inBounds, type DateRange } from '../../shared/dateFilter';
import type { Note } from '../../shared/types';
import { $, onAction, type PanelModule } from './module';

let root: HTMLElement;
let openId: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let filter: ReturnType<typeof createFilter<DateRange & { pinned: boolean }>>;

const ago = (ms: number) => {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}시간 전`;
  return new Date(ms).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
};

// Inside a day group the date is already in the header, so older notes show
// the time of day instead of a date.
const when = (ms: number) => {
  if (dateKeyOf(ms) === data.todayKey) return ago(ms);
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const card = (n: Note) => `<li class="note-card" data-action="open" data-id="${n.id}">
  <div class="row"><b class="grow todo-title">${n.pinned ? pixelIcon('star') + ' ' : ''}${esc(n.title || '제목 없음')}</b><span class="hint">${when(n.updatedAt)}</span></div>
  <div class="note-snippet">${esc(n.body.slice(0, 90)) || '<span class="hint">내용 없음</span>'}</div>
</li>`;

const openNote = (id: string | null) => {
  openId = id;
  const note = data.notes.find((n) => n.id === id);
  const editor = $(root, '#note-editor');
  editor.hidden = !note;
  $(root, '#note-browser').hidden = Boolean(note);
  if (!note) return;
  $<HTMLInputElement>(root, '#note-title').value = note.title;
  $<HTMLTextAreaElement>(root, '#note-body').value = note.body;
  $(root, '#note-pin').innerHTML = `${pixelIcon('star')} ${note.pinned ? '고정됨' : '고정'}`;
  enter(editor, 'settle');
};

const scheduleSave = () => {
  if (!openId) return;
  const id = openId;
  if (saveTimer) clearTimeout(saveTimer);
  $(root, '#note-status').textContent = '저장 중…';
  saveTimer = setTimeout(async () => {
    await api.db.updateNote(id, {
      title: $<HTMLInputElement>(root, '#note-title').value,
      body: $<HTMLTextAreaElement>(root, '#note-body').value
    });
    $(root, '#note-status').textContent = '저장됨';
    await refreshNotes();
  }, 400);
};

export const notesModule: PanelModule = {
  id: 'notes',
  label: '메모',
  icon: 'note',
  watches: ['notes'],

  mount(el) {
    root = el;
    root.innerHTML = `
      <div id="note-browser" class="notes-browser">
        <div class="row">
          <input type="text" id="note-search" class="grow" placeholder="메모 검색" />
          ${funnelButton('note-funnel', 'note-filter')}
          <button class="primary" type="button" data-action="new">＋ 새 메모</button>
        </div>
        <div class="frame well filter-panel" id="note-filter" hidden></div>
        <ul class="note-list" id="note-list"></ul>
      </div>
      <div id="note-editor" class="frame note-paper" hidden>
        <div class="row">
          <button class="ghost" type="button" data-action="back">${pixelIcon('back')} 목록</button>
          <span class="grow hint" id="note-status"></span>
          <button class="ghost" type="button" data-action="pin" id="note-pin"></button>
          <button class="ghost" type="button" data-action="delete" aria-label="메모 삭제">${pixelIcon('close')}</button>
        </div>
        <input type="text" id="note-title" maxlength="80" placeholder="제목" />
        <textarea id="note-body" placeholder="공부하면서 떠오른 걸 적어두세요"></textarea>
      </div>`;

    filter = createFilter($<HTMLButtonElement>(root, '#note-funnel'), $(root, '#note-filter'), {
      kvKey: 'filter.notes',
      defaults: { preset: 'all', from: '', to: '', pinned: false },
      extras: (state) => flagToggle('pinned', '고정한 메모만', state.pinned),
      onChange: () => notesModule.render()
    });

    const search = $<HTMLInputElement>(root, '#note-search');
    search.addEventListener('input', () => {
      data.noteQuery = search.value;
      void refreshNotes();
    });
    $(root, '#note-title').addEventListener('input', scheduleSave);
    $(root, '#note-body').addEventListener('input', scheduleSave);

    onAction(root, {
      new: async () => {
        const note = await api.db.createNote('새 메모', '');
        if (!note) return;
        data.noteQuery = '';
        search.value = '';
        await refreshNotes();
        openNote(note.id);
        $<HTMLInputElement>(root, '#note-title').select();
      },
      open: (target) => openNote(target.dataset.id!),
      back: () => openNote(null),
      pin: async () => {
        const note = data.notes.find((n) => n.id === openId);
        if (!note) return;
        await api.db.updateNote(note.id, { pinned: !note.pinned });
        await refreshNotes();
        $(root, '#note-pin').innerHTML = `${pixelIcon('star')} ${!note.pinned ? '고정됨' : '고정'}`;
      },
      delete: async () => {
        if (!openId) return;
        await api.db.deleteNote(openId);
        openNote(null);
        await refreshNotes();
      }
    });
  },

  render() {
    const bounds = filter.bounds();
    // Grouped by last edit (updatedAt), not creation: a note you just worked
    // on is one you'd look for under "오늘".
    const shown = data.notes.filter((n) => (!filter.state.pinned || n.pinned) && inBounds(dateKeyOf(n.updatedAt), bounds));
    const pinned = shown.filter((n) => n.pinned);
    const days = groupByDay(
      shown.filter((n) => !n.pinned),
      (n) => dateKeyOf(n.updatedAt)
    );
    const count = filter.active() ? `<li class="filter-count hint">메모 ${data.notes.length}개 중 ${shown.length}개</li>` : '';

    $(root, '#note-list').innerHTML = shown.length
      ? count +
        (pinned.length ? `<li class="day-head" role="presentation"><b>${pixelIcon('star')} 고정</b><span>${pinned.length}개</span></li>${pinned.map(card).join('')}` : '') +
        days.map((day) => dayHead(day.dateKey, `${day.items.length}개`) + day.items.map(card).join('')).join('')
      : count +
        `<li class="empty">${
          data.notes.length && filter.active()
            ? '조건에 맞는 메모가 없어요'
            : data.noteQuery
              ? '검색 결과가 없어요'
              : `첫 메모를 남겨보세요 ${pixelIcon('pencil')}`
        }</li>`;
  }
};
