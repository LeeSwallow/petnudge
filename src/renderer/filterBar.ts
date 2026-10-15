import { api } from './api';
import { esc } from './charts';
import { data } from './data';
import { pixelIcon } from './icons';
import { RANGE_PRESETS, dayLabel, rangeBounds, type DateRange } from '../shared/dateFilter';
import { shiftDateKey } from '../shared/stats';

// The funnel (깔때기) filter shared by the notes, todo and focus record lists:
// a toggle button plus a compact panel with a date range and whatever extra
// controls the list needs. Its state is remembered per list in kv.

export type FilterState = DateRange & Record<string, string | boolean>;

export const funnelButton = (id: string, controls: string) =>
  `<button class="ghost funnel" type="button" id="${id}" aria-controls="${controls}" aria-expanded="false" data-tip="필터">${pixelIcon('funnel', '필터')}</button>`;

export const segmented = (name: string, options: [string, string][], current: string, label: string) =>
  `<div class="seg" role="group" aria-label="${esc(label)}">${options
    .map(([value, text]) => `<button type="button" data-seg="${name}" data-value="${value}" aria-pressed="${value === current}">${esc(text)}</button>`)
    .join('')}</div>`;

export const flagToggle = (name: string, label: string, on: boolean) =>
  `<label class="toggle">${esc(label)}<input type="checkbox" data-flag="${name}" ${on ? 'checked' : ''} /></label>`;

// Day header row for grouped lists; `extra` is a short right-aligned note.
export const dayHead = (dateKey: string, extra: string) =>
  `<li class="day-head" role="presentation"><b>${dayLabel(dateKey, data.todayKey)}</b><span>${extra}</span></li>`;

type Options<T extends FilterState> = {
  kvKey: string;
  defaults: T;
  // Extra controls under the date row (built with `segmented` / `flagToggle`,
  // or a <select data-field="…">).
  extras?: (state: T) => string;
  onChange: () => void;
};

export const createFilter = <T extends FilterState>(button: HTMLButtonElement, panel: HTMLElement, options: Options<T>) => {
  const state = { ...options.defaults };
  const fields = state as Record<string, string | boolean>;

  const active = () =>
    Object.keys(options.defaults).some((key) => key !== 'from' && key !== 'to' && fields[key] !== options.defaults[key]);

  // Button highlight and the reset link follow state without re-rendering, so
  // a date input being typed into keeps its focus.
  const sync = () => {
    button.classList.toggle('on', active());
    button.setAttribute('aria-expanded', String(!panel.hidden));
    const reset = panel.querySelector<HTMLElement>('[data-filter-reset]');
    if (reset) reset.hidden = !active();
  };

  const render = () => {
    panel.innerHTML = `
      ${segmented('preset', RANGE_PRESETS, state.preset, '기간')}
      ${
        state.preset === 'custom'
          ? `<div class="row filter-dates">
              <input type="date" data-date="from" value="${esc(state.from)}" max="${data.todayKey}" aria-label="시작 날짜" />
              <span>~</span>
              <input type="date" data-date="to" value="${esc(state.to)}" max="${data.todayKey}" aria-label="끝 날짜" />
            </div>`
          : ''
      }
      ${options.extras?.(state) ?? ''}
      <button class="ghost filter-reset" type="button" data-filter-reset hidden>필터 초기화</button>`;
    sync();
  };

  const changed = (rerender: boolean) => {
    if (rerender) render();
    else sync();
    void api.db.setKv(options.kvKey, JSON.stringify(state));
    options.onChange();
  };

  panel.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-seg], [data-filter-reset]') : null;
    if (!target) return;
    if (target.hasAttribute('data-filter-reset')) {
      Object.assign(state, options.defaults);
    } else {
      fields[target.dataset.seg!] = target.dataset.value!;
      // Start a custom range at the last week so it isn't empty.
      if (target.dataset.seg === 'preset' && state.preset === 'custom' && !state.from && !state.to) {
        Object.assign(state, { from: shiftDateKey(data.todayKey, -6), to: data.todayKey });
      }
    }
    changed(true);
  });

  panel.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    if (input instanceof HTMLInputElement && input.dataset.flag) fields[input.dataset.flag] = input.checked;
    else if (input.dataset.date) fields[input.dataset.date] = input.value;
    else if (input.dataset.field) fields[input.dataset.field] = input.value;
    else return;
    changed(false);
  });

  button.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) render();
    sync();
  });

  panel.hidden = true;
  render();

  // Restore the remembered filter (only known keys of the right type).
  void api.db.getKv(options.kvKey).then((raw) => {
    try {
      const saved = JSON.parse(raw ?? '{}') as Record<string, unknown>;
      for (const key of Object.keys(options.defaults)) {
        if (typeof saved[key] === typeof options.defaults[key]) fields[key] = saved[key] as string | boolean;
      }
      if (!RANGE_PRESETS.some(([preset]) => preset === state.preset)) state.preset = options.defaults.preset;
    } catch {
      // ignore a corrupt value and keep the defaults
    }
    render();
    options.onChange();
  });

  return {
    state,
    active,
    bounds: () => rangeBounds(state, data.todayKey),
    panelHidden: () => panel.hidden,
    // Re-render the panel (e.g. when a select's choices change).
    refresh: render
  };
};
