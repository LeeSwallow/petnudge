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
  import { t } from '../../i18n';
  import { emptyText, snippet, visibleNotes, when } from './logic';

  let query = $state('');
  let openId = $state<string | null>(null);
  // the open note as last seen: a search can drop it from data.notes while it
  // is being edited, and the editor stays open regardless
  let opened = $state.raw<Note | null>(null);
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
      extras: (state) => flagToggle('pinned', t('notes.pinnedOnly'), state.pinned),
      onChange: () => (filterRev += 1)
    });
  });

  const view = $derived.by(() => {
    void revision.notes, revision.shown, filterRev;
    const notes = data.notes;
    const list = visibleNotes(notes, filter?.bounds() ?? { from: null, to: null }, Boolean(filter?.state.pinned));
    return {
      total: notes.length,
      filtered: filter?.active() ?? false,
      ...list,
      days: groupByDay(list.others, (n) => dateKeyOf(n.updatedAt)),
      open: openId ? notes.find((n) => n.id === openId) ?? opened : null
    };
  });

  const search = () => {
    data.noteQuery = query;
    void refreshNotes();
  };

  const openNote = async (id: string | null) => {
    openId = id;
    const note = data.notes.find((n) => n.id === id);
    opened = note ?? null;
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
    status = t('notes.saving');
    saveTimer = setTimeout(async () => {
      await api.db.updateNote(id, { title, body });
      if (opened?.id === id) opened = { ...opened, title, body, updatedAt: Date.now() };
      status = t('notes.saved');
      await refreshNotes();
    }, 400);
  };

  const create = async () => {
    const note = await api.db.createNote(t('notes.newTitle'), '');
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
    opened = { ...note, pinned: !note.pinned };
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
    <div class="row"><b class="grow todo-title">{@html n.pinned ? pixelIcon('star') + ' ' : ''}{n.title || t('common.untitled')}</b><span class="hint">{when(n.updatedAt, data.todayKey, Date.now())}</span></div>
    <div class="note-snippet">{#if snippet(n.body)}{snippet(n.body)}{:else}<span class="hint">{t('notes.noBody')}</span>{/if}</div>
  </li>
{/snippet}

<div id="note-browser" class="notes-browser" hidden={Boolean(openId)}>
  <div class="row">
    <input type="text" id="note-search" class="grow" placeholder={t('notes.search')} bind:value={query} oninput={search} />
    <span class="funnel-slot" bind:this={funnelSlot}>{@html funnelButton('note-funnel', 'note-filter')}</span>
    <button class="primary" type="button" onclick={create}>＋ {t('notes.new')}</button>
  </div>
  <div class="frame well filter-panel" id="note-filter" hidden bind:this={filterPanel}></div>
  <ul class="note-list" id="note-list">
    {#if view.filtered}<li class="filter-count hint">{t('notes.filteredCount', { shown: view.shown.length, total: view.total })}</li>{/if}
    {#if view.shown.length}
      {#if view.pinned.length}
        <li class="day-head" role="presentation"><b>{@html pixelIcon('star')} {t('notes.pinned')}</b><span>{t('common.count', { count: view.pinned.length })}</span></li>
        {#each view.pinned as n (n.id)}{@render card(n)}{/each}
      {/if}
      {#each view.days as day (day.dateKey)}
        {@html dayHead(day.dateKey, t('common.count', { count: day.items.length }))}
        {#each day.items as n (n.id)}{@render card(n)}{/each}
      {/each}
    {:else}
      {@const text = emptyText(view.total, view.filtered, data.noteQuery)}
      <li class="empty">{text}{#if !view.total && !data.noteQuery}&nbsp;{@html pixelIcon('pencil')}{/if}</li>
    {/if}
  </ul>
</div>
<div id="note-editor" class="frame note-paper" hidden={!openId} bind:this={editor}>
  <div class="row">
    <button class="ghost" type="button" onclick={() => (openId = null)}>{@html pixelIcon('back')} {t('notes.list')}</button>
    <span class="grow hint" id="note-status">{status}</span>
    <button class="ghost" type="button" id="note-pin" onclick={togglePin}>{@html pixelIcon('star')} {view.open?.pinned ? t('notes.pinnedOn') : t('notes.pin')}</button>
    <button class="ghost" type="button" aria-label={t('notes.delete')} onclick={remove}>{@html pixelIcon('close')}</button>
  </div>
  <input type="text" id="note-title" maxlength="80" placeholder={t('notes.titlePlaceholder')} bind:value={title} bind:this={titleInput} oninput={scheduleSave} />
  <textarea id="note-body" placeholder={t('notes.bodyPlaceholder')} bind:value={body} oninput={scheduleSave}></textarea>
</div>

<style>
  .funnel-slot { display: contents; }
</style>
