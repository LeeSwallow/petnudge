<script lang="ts">
  type Props = { checked?: boolean; label: string; onchange?: (checked: boolean) => void };
  let { checked = $bindable(false), label, onchange }: Props = $props();
</script>

<label class="ui-check">
  <input type="checkbox" bind:checked onchange={() => onchange?.(checked)} />
  <span class="box" aria-hidden="true"></span>
  <span class="text">{label}</span>
</label>

<style>
  .ui-check { display: inline-flex; align-items: center; gap: var(--space-2); cursor: pointer; }
  input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .box {
    width: 14px;
    height: 14px;
    flex: none;
    background: var(--color-well);
    border: var(--stroke-frame) solid var(--color-edge);
  }
  input:checked + .box { background: var(--color-long); box-shadow: inset 0 0 0 2px var(--color-well); }
  input:focus-visible + .box { outline: var(--stroke-frame) solid var(--color-goal); }
</style>
