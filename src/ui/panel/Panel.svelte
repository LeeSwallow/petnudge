<script lang="ts">
  import { flushSync } from 'svelte';
  import type { ModuleId, UiModule } from '../modules/module';
  import { pixelIcon } from '../../renderer/icons';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import Tabs from '../components/Tabs.svelte';
  import { logError } from '../log';
  import { t } from '../i18n';
  import { DEFAULT_MODULE, groupOf, modulesIn, shownModules, visibleGroups, type GroupId } from './groups';

  type Props = {
    modules: readonly UiModule[];
    // after a module is shown (persist it, animate)
    onshow: (id: ModuleId, animate: boolean) => void;
    onquit: () => void;
  };
  let { modules, onshow, onquit }: Props = $props();

  let current = $state<ModuleId>(DEFAULT_MODULE);
  // the module each group showed last, so a group opens where it was left
  const lastIn: Partial<Record<GroupId, ModuleId>> = {};
  // only modules whose group is shown get a tab and a body
  const shown = $derived(shownModules(modules));
  const group = $derived(groupOf(modules, current));
  const groupItems = $derived(visibleGroups().map((g) => ({ id: g.id, label: g.label, icon: g.icon })));
  const inGroup = $derived(modulesIn(shown, group).map((m) => ({ id: m.id, label: m.label, icon: m.icon })));

  export const show = (id: ModuleId, animate = true) => {
    current = id;
    lastIn[groupOf(modules, id)] = id;
    flushSync();
    onshow(id, animate);
  };
  export const active = () => current;

  const selectGroup = (id: string) => {
    const g = visibleGroups().find((x) => x.id === id);
    const first = g && modulesIn(shown, g.id)[0];
    if (g && first) show(lastIn[g.id] ?? first.id);
  };
</script>

<div class="ui-panel">
  <Tabs variant="group" key="group" label={t('panel.groupsLabel')} items={groupItems} selected={group} onselect={selectGroup} />
  {#if inGroup.length > 1}
    <Tabs variant="sub" key="module" label={t('panel.modulesLabel')} items={inGroup} selected={current} onselect={(id) => show(id as ModuleId)} />
  {/if}
  <div class="module-host">
    {#each shown as module (module.id)}
      <div class="tab-body" role="tabpanel" aria-label={module.label} data-body={module.id} hidden={module.id !== current}>
        <!-- one tab failing leaves the others working; the failure goes to the log -->
        <svelte:boundary onerror={(error) => logError(`panel:${module.id}`, error)}>
          <module.component />
          {#snippet failed(_error, reset)}
            <div class="module-failed" data-failed={module.id}>
              <EmptyState text={t('panel.tabFailed')} />
              <Button onclick={reset}>{t('panel.retry')}</Button>
            </div>
          {/snippet}
        </svelte:boundary>
      </div>
    {/each}
  </div>
  {#if group === 'settings'}
    <footer>
      <button type="button" class="quit" data-quit onclick={onquit}>{@html pixelIcon('power')}<span>{t('panel.quit')}</span></button>
    </footer>
  {/if}
</div>

<style>
  .ui-panel {
    min-height: 0;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
  }
  .ui-panel :global(.ui-tabs.group) { background: var(--color-well); }
  footer {
    flex: none;
    display: flex;
    justify-content: flex-end;
    padding: var(--space-1) var(--space-2) var(--space-2);
    border-top: var(--stroke-frame) solid var(--color-well);
  }
  .quit {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    font: var(--type-small) var(--font-small);
    color: var(--color-muted);
    background: var(--color-well);
    border: var(--stroke-frame) solid var(--color-shadow);
    box-shadow: none;
    border-radius: 0;
    cursor: pointer;
  }
  .quit:hover { color: #ff8fa3; border-color: #df6074; }
  .module-failed { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); }
  .quit:focus-visible { outline: var(--stroke-frame) solid var(--color-goal); outline-offset: -2px; }
</style>
