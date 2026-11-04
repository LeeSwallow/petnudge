<script lang="ts">
  import { pixelIcon } from '../../../renderer/icons';
  import { revision } from '../../state/revision.svelte';
  import { myMusic, type MusicFeed } from './feed';
  import { EMPTY_TEXT, musicView } from './logic';

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
      <button type="button" class="act" aria-label={view.playing ? '일시정지' : '재생'} data-tip={view.playing ? '일시정지' : '재생'} onclick={() => feed.toggle?.()}>
        {@html pixelIcon(view.playing ? 'pause' : 'play')}
      </button>
    {/if}
  </div>
{:else}
  <p class="empty" data-music-empty>{EMPTY_TEXT}</p>
{/if}

<style>
  .now { display: flex; align-items: center; gap: var(--space-2); }
  .text { flex: 1 1 auto; min-width: 0; }
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
