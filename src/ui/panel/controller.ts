import { mount } from 'svelte';
import type { ModuleId, UiModule } from '../modules/module';
import Panel from './Panel.svelte';

export type PanelController = {
  show(id: ModuleId, animate?: boolean): void;
  active(): ModuleId;
};

type Options = {
  onShow: (id: ModuleId, body: HTMLElement, tab: HTMLElement | null, animate: boolean) => void;
  onQuit: () => void;
};

// The panel shell: big tabs (groups), small tabs (modules), each module a
// Svelte component that follows `revision` by itself.
export const createPanel = (target: HTMLElement, modules: readonly UiModule[], options: Options): PanelController => {
  const panel = mount(Panel, {
    target,
    props: {
      modules,
      onquit: options.onQuit,
      onshow: (id: ModuleId, animate: boolean) =>
        options.onShow(id, target.querySelector<HTMLElement>(`[data-body="${id}"]`)!, target.querySelector<HTMLElement>(`[data-module="${id}"]`), animate)
    }
  }) as { show: (id: ModuleId, animate?: boolean) => void; active: () => ModuleId };
  return { show: (id, animate = true) => panel.show(id, animate), active: () => panel.active() };
};
