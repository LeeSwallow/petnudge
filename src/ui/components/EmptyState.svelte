<script lang="ts">
  let { text }: { text: string } = $props();
</script>

<p class="ui-empty">{text}</p>

<style>
  .ui-empty {
    margin: 0;
    padding: var(--space-5) var(--space-2);
    text-align: center;
    font: var(--type-small) var(--font-small);
    color: var(--color-muted);
  }
</style>
