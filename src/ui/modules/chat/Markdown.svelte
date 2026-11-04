<script lang="ts">
  import { logError } from '../../log';
  import { parseMarkdown, type Inline } from './markdown';

  // A pet's reply in the chat tab, drawn from the parsed tree (markdown.ts).
  // Only text nodes carry the model's words: nothing here is read as HTML.
  // A link is a button that asks first (`onlink`); a code block can be copied.

  let { text, onlink }: { text: string; onlink: (href: string) => void } = $props();

  const blocks = $derived(parseMarkdown(text));
  let copied = $state<number | null>(null);
  let timer = 0;

  const copy = async (i: number, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      copied = i;
      clearTimeout(timer);
      timer = window.setTimeout(() => (copied = null), 1500);
    } catch (error) {
      logError('chat:copy', error, 'warn');
    }
  };
</script>

{#snippet inline(nodes: Inline[])}{#each nodes as n, i (i)}{#if n.t === 'text'}{n.v}{:else if n.t === 'br'}<br />{:else if n.t === 'code'}<code class="md-code">{n.v}</code>{:else if n.t === 'strong'}<strong>{@render inline(n.c)}</strong>{:else if n.t === 'em'}<em>{@render inline(n.c)}</em>{:else if n.t === 'link'}<button type="button" class="md-link" data-href={n.href} title={n.href} onclick={() => onlink(n.href)}>{@render inline(n.c)}</button>{/if}{/each}{/snippet}

<div class="md">
  {#each blocks as b, i (i)}
    {#if b.t === 'p'}
      <p>{@render inline(b.c)}</p>
    {:else if b.t === 'ul'}
      <ul>{#each b.items as item, j (j)}<li>{@render inline(item)}</li>{/each}</ul>
    {:else if b.t === 'ol'}
      <ol start={b.start}>{#each b.items as item, j (j)}<li>{@render inline(item)}</li>{/each}</ol>
    {:else}
      <div class="md-block">
        <button type="button" class="ghost mini md-copy" aria-label="코드 복사" onclick={() => copy(i, b.v)}>{copied === i ? '복사됨' : '복사'}</button>
        <pre><code>{b.v}</code></pre>
      </div>
    {/if}
  {/each}
</div>

<style>
  .md {
    white-space: normal;
  }

  .md p,
  .md li {
    white-space: pre-wrap;
    margin: 0;
  }

  .md > * + * {
    margin-top: 4px;
  }

  .md ul,
  .md ol {
    margin: 0;
    padding-left: 16px;
  }

  .md-code,
  .md pre {
    font-family: var(--font-digits);
  }

  .md-code {
    padding: 0 2px;
    background: var(--color-panel);
  }

  .md-block {
    position: relative;
  }

  .md pre {
    margin: 0;
    padding: 6px 8px;
    padding-top: 18px;
    overflow-x: auto;
    white-space: pre;
    background: var(--color-panel);
    border: 2px solid var(--color-edge);
  }

  .md-copy {
    position: absolute;
    top: 2px;
    right: 2px;
  }

  .md-link {
    display: inline;
    padding: 0;
    border: 0;
    background: none;
    box-shadow: none;
    font: inherit;
    color: var(--color-focus);
    text-decoration: underline;
    cursor: pointer;
  }
</style>
