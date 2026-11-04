<script lang="ts">
  type Props = { value: number; max: number; label: string; tone?: 'focus' | 'long' | 'break' | 'goal' };
  let { value, max, label, tone = 'long' }: Props = $props();
  const percent = $derived(max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0);
</script>

<div class="ui-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
  <div class="fill" style:width="{percent}%" style:background="var(--color-{tone})"></div>
</div>

<style>
  .ui-progress { height: 10px; background: var(--color-well); border: var(--stroke-frame) solid var(--color-shadow); }
  .fill { height: 100%; }
</style>
