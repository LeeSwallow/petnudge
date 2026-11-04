<script lang="ts">
  import { pixelIcon } from '../../../renderer/icons';
  import { revision } from '../../state/revision.svelte';
  import { t } from '../../i18n';
  import { myMusic, type MusicFeed } from './feed';
  import { emptyText, musicView } from './logic';

  let { feed = myMusic }: { feed?: MusicFeed } = $props();

  const view = $derived.by(() => {
    void revision.music, revision.playlists;
    return musicView(feed.read());
  });
</script>

{#if view}
  <div class="now">
    <div class="text">
      <div class="title" data-music-title>{view.title}</div>
      {#if view.subtitle}<div class="sub">{view.subtitle}</div>{/if}
    </div>
    {#if feed.toggle}
      <button type="button" class="act" aria-label={view.playing ? t('pomodoro.pause') : t('widgets.music.play')} data-tip={view.playing ? t('pomodoro.pause') : t('widgets.music.play')} onclick={() => feed.toggle?.()}>
        {@html pixelIcon(view.playing ? 'pause' : 'play')}
      </button>
    {/if}
    {#if feed.next}
      <button type="button" class="act" aria-label={t('widgets.music.next')} data-tip={t('widgets.music.next')} data-music-next onclick={() => feed.next?.()}>
        {@html pixelIcon('next')}
      </button>
    {/if}
  </div>
{:else}
  <p class="empty" data-music-empty>{emptyText()}</p>
{/if}

<style>
  .now { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
  /* narrow (the dock): the buttons go under the title */
  .text { flex: 1 1 64px; min-width: 0; }
  .title, .sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title { font: var(--type-body) var(--font); color: var(--color-ink); }
  .sub, .empty { font: var(--type-small) var(--font-small); color: var(--color-muted); }
  .empty { margin: 0; }
  .act {
    flex: none;
    width: 28px;
    height: 26px;
    padding: 0;
    display: inline-grid;
    place-items: center;
    background: var(--color-panel);
    border: var(--stroke-frame) solid var(--color-edge);
    box-shadow: var(--shadow-sm) var(--shadow-sm) 0 var(--color-shadow);
    border-radius: 0;
    cursor: pointer;
  }
  .act:focus-visible { outline: var(--stroke-frame) solid var(--color-goal); outline-offset: -2px; }
</style>
