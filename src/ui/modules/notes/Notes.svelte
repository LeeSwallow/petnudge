<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { api } from '../../../renderer/api';
  import { data, refreshNotes } from '../../../renderer/data';
  import { createFilter, dayHead, flagToggle, funnelButton } from '../../../renderer/filterBar';
  import { enter } from '../../../renderer/fx';
  import { pixelIcon } from '../../../renderer/icons';
  import { dateKeyOf, groupByDay, type DateRange } from '../../../shared/dateFilter';
  import type { Note } from '../../../shared/types';
  import { revision } from '../../state/revision.svelte';
  import { emptyText, snippet, visibleNotes, when } from './logic';

  let query = $state('');
  let openId = $state<string | null>(null);
  // the editor's fields are set when a note opens, never by a list refresh,
  // so what is being typed (and an IME composition) is never overwritten
  let title = $state('');
  let body = $state('');
  let status = $state('');
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let filterRev = $state(0);
  let funnelSlot: HTMLElement;
  let filterPanel: HTMLElement;
  let editor: HTMLElement;
  let titleInput: HTMLInputElement;
  let filter: ReturnType<typeof createFilter<DateRange & { pinned: boolean }>> | null = $state.raw(null);

  onMount(() => {
    filter = createFilter(funnelSlot.querySelector<HTMLButtonElement>('#note-funnel')!, filterPanel, {
      kvKey: 'filter.notes',
      defaults: { preset: 'all', from: '', to: '', pinned: false },
      extras: (state) => flagToggle('pinned', '고정한 메모만', state.pinned),
      onChange: () => (filterRev += 1)
    });
  });

  const view = $derived.by(() => {
    void revision.notes, filterRev;
    const notes = data.notes;
    const list = visibleNotes(notes, filter?.bounds() ?? { from: null, to: null }, Boolean(filter?.state.pinned));
    return {
      total: notes.length,
      filtered: filter?.active() ?? false,
      ...list,
      days: groupByDay(list.others, (n) => dateKeyOf(n.updatedAt)),
      open: notes.find((n) => n.id === openId)
    };
  });

  const search = () => {
    data.noteQuery = query;
    void refreshNotes();
  };

  const openNote = async (id: string | null) => {
    openId = id;
    const note = data.notes.find((n) => n.id === id);
    if (!note) return;
    title = note.title;
    body = note.body;
    status = '';
    await tick();
    enter(editor, 'settle');
  };

  const scheduleSave = () => {
    if (!openId) return;
    const id = openId;
    if (saveTimer) clearTimeout(saveTimer);
    status = '저장 중…';
    saveTimer = setTimeout(async () => {
      await api.db.updateNote(id, { title, body });
      status = '저장됨';
      await refreshNotes();
    }, 400);
  };

  const create = async () => {
    const note = await api.db.createNote('새 메모', '');
    if (!note) return;
    data.noteQuery = '';
    query = '';
    await refreshNotes();
    await openNote(note.id);
    titleInput.select();
  };

  const togglePin = async () => {
    const note = view.open;
    if (!note) return;
    await api.db.updateNote(note.id, { pinned: !note.pinned });
    await refreshNotes();
  };

  const remove = async () => {
    if (!openId) return;
    await api.db.deleteNote(openId);
    openId = null;
    await refreshNotes();
  };
</script>

{#snippet card(n: Note)}
  <!-- a whole card opens the note, as before; the card list keeps its <li> markup and styles -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <li class="note-card" onclick={() => openNote(n.id)}>
    <div class="row"><b class="grow todo-title">{@html n.pinned ? pixelIcon('star') + ' ' : ''}{n.title || '제목 없음'}</b><span class="hint">{when(n.updatedAt, data.todayKey, Date.now())}</span></div>
    <div class="note-snippet">{#if snippet(n.body)}{snippet(n.body)}{:else}<span class="hint">내용 없음</span>{/if}</div>
  </li>
{/snippet}

<div id="note-browser" class="notes-browser" hidden={Boolean(view.open)}>
  <div class="row">
    <input type="text" id="note-search" class="grow" placeholder="메모 검색" bind:value={query} oninput={search} />
    <span class="funnel-slot" bind:this={funnelSlot}>{@html funnelButton('note-funnel', 'note-filter')}</span>
    <button class="primary" type="button" onclick={create}>＋ 새 메모</button>
  </div>
  <div class="frame well filter-panel" id="note-filter" hidden bind:this={filterPanel}></div>
  <ul class="note-list" id="note-list">
    {#if view.filtered}<li class="filter-count hint">메모 {view.total}개 중 {view.shown.length}개</li>{/if}
    {#if view.shown.length}
      {#if view.pinned.length}
        <li class="day-head" role="presentation"><b>{@html pixelIcon('star')} 고정</b><span>{view.pinned.length}개</span></li>
        {#each view.pinned as n (n.id)}{@render card(n)}{/each}
      {/if}
      {#each view.days as day (day.dateKey)}
        {@html dayHead(day.dateKey, `${day.items.length}개`)}
        {#each day.items as n (n.id)}{@render card(n)}{/each}
      {/each}
    {:else}
      {@const text = emptyText(view.total, view.filtered, data.noteQuery)}
      <li class="empty">{text}{#if text === '첫 메모를 남겨보세요'}&nbsp;{@html pixelIcon('pencil')}{/if}</li>
    {/if}
  </ul>
</div>
<div id="note-editor" class="frame note-paper" hidden={!view.open} bind:this={editor}>
  <div class="row">
    <button class="ghost" type="button" onclick={() => (openId = null)}>{@html pixelIcon('back')} 목록</button>
    <span class="grow hint" id="note-status">{status}</span>
    <button class="ghost" type="button" id="note-pin" onclick={togglePin}>{@html pixelIcon('star')} {view.open?.pinned ? '고정됨' : '고정'}</button>
    <button class="ghost" type="button" aria-label="메모 삭제" onclick={remove}>{@html pixelIcon('close')}</button>
  </div>
  <input type="text" id="note-title" maxlength="80" placeholder="제목" bind:value={title} bind:this={titleInput} oninput={scheduleSave} />
  <textarea id="note-body" placeholder="공부하면서 떠오른 걸 적어두세요" bind:value={body} oninput={scheduleSave}></textarea>
</div>

<style>
  .funnel-slot { display: contents; }
</style>
