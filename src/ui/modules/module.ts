import type { Component } from 'svelte';
import type { PixelIconName } from '../../renderer/icons';
import type { ModuleId, PanelModule } from '../../renderer/modules/module';

// A panel module written in Svelte: it reacts to `revision` by itself, so the
// shell never calls render() on it.
export type UiModule = { id: ModuleId; label: string; icon: PixelIconName; component: Component };

// While modules move over, the panel holds both kinds.
export type AnyModule = PanelModule | UiModule;
export const isUiModule = (m: AnyModule): m is UiModule => 'component' in m;
