import { mount } from 'svelte';
import type { Cause } from '../state/bridge';
import type { ModuleId } from '../../renderer/modules/module';
import { isUiModule, type AnyModule } from '../modules/module';
import Panel from './Panel.svelte';

export type RenderCause = Cause;

export type PanelController = {
  show(id: ModuleId, animate?: boolean): void;
  active(): ModuleId;
  // Re-renders the module on screen when the change is one it watches.
  render(cause: RenderCause): void;
  // Re-renders the module on screen (the panel was just opened).
  refresh(): void;
};

type Options = {
  // whether the panel is open (closed panels render nothing)
  visible: () => boolean;
  onShow: (id: ModuleId, body: HTMLElement, tab: HTMLElement | null, animate: boolean) => void;
  onQuit: () => void;
};

// The panel shell: big tabs (groups), small tabs (modules), the older modules
// mounted once each. Replaces the hand-built tab row of renderer.ts.
export const createPanel = (target: HTMLElement, modules: AnyModule[], options: Options): PanelController => {
  const moduleOf = (id: ModuleId) => modules.find((m) => m.id === id)!;
  // Older modules re-render on demand; Svelte ones react to `revision`.
  const renderOld = (id: ModuleId) => {
    const module = moduleOf(id);
    if (!isUiModule(module)) module.render();
  };
  const panel = mount(Panel, {
    target,
    props: {
      modules,
      onquit: options.onQuit,
      onshow: (id: ModuleId, animate: boolean) => {
        const body = target.querySelector<HTMLElement>(`[data-body="${id}"]`)!;
        renderOld(id);
        options.onShow(id, body, target.querySelector<HTMLElement>(`[data-module="${id}"]`), animate);
      }
    }
  }) as { show: (id: ModuleId, animate?: boolean) => void; active: () => ModuleId };
  return {
    show: (id, animate = true) => panel.show(id, animate),
    active: () => panel.active(),
    render: (cause) => {
      if (!options.visible()) return;
      const module = moduleOf(panel.active());
      if (!isUiModule(module) && (module.watches as Cause[]).includes(cause)) module.render();
    },
    refresh: () => renderOld(panel.active())
  };
};
