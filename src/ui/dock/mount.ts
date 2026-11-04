import { mount } from 'svelte';
import Dock from './Dock.svelte';
import { dock, loadDock } from './store.svelte';

export type DockController = {
  // Where she stands in the window (the 'layout' message) and her width.
  setLayout(petDx: number, petWidth: number): void;
  // The nearest friend's offset (positive: to her right), or null.
  setFriend(dx: number | null): void;
  setPanelOpen(open: boolean): void;
};

type Options = { windowWidth: number; onhover: (over: boolean) => void; onheight: (px: number) => void };

export const mountDock = (target: HTMLElement, options: Options): DockController => {
  mount(Dock, { target, props: options });
  void loadDock();
  return {
    setLayout: (petDx, petWidth) => {
      dock.petDx = petDx;
      if (petWidth > 0) dock.petWidth = petWidth;
    },
    setFriend: (dx) => (dock.friendDx = dx),
    setPanelOpen: (open) => (dock.panelOpen = open)
  };
};
