import { formatMinutes, heatLevel } from '../shared/stats';
import type { DailyFocus, HourlyFocus } from '../shared/types';
import { formatDate, getLocale, t } from '../i18n';

// Every chart is an SVG string built from whole-pixel rects (no anti-aliased
// curves) so it matches the pixel UI. Marks carry `data-tip` for the shared
// hover tooltip.

const esc = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const dateOf = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

// Weekday names come from Intl; English needs three letters (M, T, W, T…
// would be ambiguous), Korean and Japanese one.
const weekdayStyle = () => (getLocale() === 'ko' || getLocale() === 'ja' ? 'narrow' : 'short');
const weekdayName = (date: Date) => formatDate(date, { weekday: weekdayStyle(), timeZone: 'UTC' });

export const BLOCK_MINUTES = 25;

const shortDate = (dateKey: string) => formatDate(dateOf(dateKey), { month: 'numeric', day: 'numeric', timeZone: 'UTC' });

const weekdayOf = (dateKey: string) => weekdayName(dateOf(dateKey));

// Dotted ring of square "pixels"; filled clockwise from 12 o'clock.
export const progressRing = (progress: number, color: string, size = 156, segments = 48) => {
  const center = size / 2;
  const radius = center - 8;
  const filled = Math.round(Math.min(1, Math.max(0, progress)) * segments);
  const dots = Array.from({ length: segments }, (_, i) => {
    const angle = (i / segments) * Math.PI * 2 - Math.PI / 2;
    const x = Math.round(center + Math.cos(angle) * radius) - 3;
    const y = Math.round(center + Math.sin(angle) * radius) - 3;
    const on = i < filled;
    return `<rect x="${x}" y="${y}" width="6" height="6" fill="${on ? color : 'var(--well)'}" ${
      on ? '' : 'stroke="var(--edge)" stroke-width="1"'
    }/>`;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(t('charts.progress', { percent: Math.round(progress * 100) }))}%">${dots}</svg>`;
};

// 7x7 pixel tomato; `filled` ones are earned sessions, the rest the daily goal.
const TOMATO = ['..g.g..', '...g...', '.rrrrr.', 'rrrrrrr', 'rrrrrrr', 'rrrrrrr', '.rrrrr.'];

const tomato = (x: number, filled: boolean, tip: string) =>
  `<g data-tip="${esc(tip)}">${TOMATO.flatMap((row, y) =>
    [...row].map((cell, cx) => {
      if (cell === '.') return '';
      const fill = cell === 'g' ? (filled ? '#59d38a' : 'var(--edge)') : filled ? 'var(--focus)' : 'var(--well)';
      const stroke = !filled && cell === 'r' ? 'stroke="var(--edge)" stroke-width="0.5"' : '';
      return `<rect x="${x + cx * 2}" y="${y * 2}" width="2" height="2" fill="${fill}" ${stroke}/>`;
    })
  ).join('')}</g>`;

export const tomatoRow = (done: number, goal: number) => {
  const count = Math.max(goal, done);
  const width = count * 17;
  const items = Array.from({ length: count }, (_, i) =>
    tomato(i * 17, i < done, i < done ? t('charts.sessionDone', { n: i + 1 }) : t('charts.toGoal', { count: count - i }))
  ).join('');
  return `<svg class="chart" width="${width}" height="14" viewBox="0 0 ${width} 14" role="img" aria-label="${esc(t('charts.todaySessions', { done, goal }))}">${items}</svg>`;
};

// Daily focus minutes as stacked 25-minute blocks, with the goal as a dotted line.
export const weekBars = (days: DailyFocus[], goalMinutes: number, todayKey: string) => {
  const width = 336;
  const height = 120;
  const top = 10;
  const baseline = 98;
  const column = width / days.length;
  const barWidth = 22;
  const goalBlocks = Math.ceil(goalMinutes / BLOCK_MINUTES);
  const maxBlocks = Math.max(goalBlocks, ...days.map((d) => Math.ceil(d.minutes / BLOCK_MINUTES)), 1);
  const block = Math.max(2, Math.min(8, Math.floor((baseline - top) / maxBlocks)));
  const blockGap = block > 4 ? 2 : 1;

  const bars = days
    .map((day, i) => {
      const x = Math.round(i * column + (column - barWidth) / 2);
      const blocks = Math.ceil(day.minutes / BLOCK_MINUTES);
      const isToday = day.dateKey === todayKey;
      const fill = isToday ? 'var(--focus)' : 'var(--edge-hi)';
      const tip = `${shortDate(day.dateKey)} (${weekdayOf(day.dateKey)}) · ${formatMinutes(day.minutes)} · ${t('charts.sessions', { count: day.sessions })}`;
      const stack = Array.from(
        { length: blocks },
        (_, b) => `<rect x="${x}" y="${baseline - (b + 1) * block}" width="${barWidth}" height="${block - blockGap}" fill="${fill}"/>`
      ).join('');
      const hit = `<rect x="${Math.round(i * column)}" y="${top}" width="${Math.round(column)}" height="${baseline - top}" fill="transparent"/>`;
      const label = `<text x="${x + barWidth / 2}" y="${baseline + 14}" text-anchor="middle" class="${
        isToday ? 'label-strong' : ''
      }">${weekdayOf(day.dateKey)}</text>`;
      const value =
        day.minutes > 0
          ? `<text x="${x + barWidth / 2}" y="${baseline - blocks * block - 3}" text-anchor="middle" class="${
              isToday ? 'label-strong' : ''
            }">${isToday || day.minutes === Math.max(...days.map((d) => d.minutes)) ? Math.round(day.minutes) : ''}</text>`
          : '';
      return `<g data-tip="${esc(tip)}">${hit}${stack}${value}${label}</g>`;
    })
    .join('');

  const goalY = baseline - goalBlocks * block;
  const goal = `<line x1="0" x2="${width}" y1="${goalY}" y2="${goalY}" stroke="var(--goal)" stroke-width="1" stroke-dasharray="3 3"/>
    <text x="${width}" y="${goalY - 3}" text-anchor="end" fill="var(--goal)">${esc(t('charts.goal', { time: formatMinutes(goalMinutes) }))}</text>`;
  const axis = `<rect x="0" y="${baseline}" width="${width}" height="1" fill="var(--edge)"/>`;

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" height="${height}" role="img" aria-label="${esc(t('charts.week'))}">${axis}${goal}${bars}</svg>`;
};

// Minutes focused per hour of day.
export const hourBars = (hours: HourlyFocus[]) => {
  const width = 336;
  const height = 70;
  const baseline = 52;
  const column = width / 24;
  const max = Math.max(...hours.map((h) => h.minutes), 1);
  const peak = hours.reduce((best, h) => (h.minutes > best.minutes ? h : best), hours[0]);

  const bars = hours
    .map((h) => {
      const x = Math.round(h.hour * column + 2);
      const barHeight = h.minutes > 0 ? Math.max(2, Math.round(((baseline - 6) * h.minutes) / max / 2) * 2) : 0;
      const tip = `${t('charts.hour', { hour: h.hour })} · ${formatMinutes(h.minutes)}`;
      return `<g data-tip="${esc(tip)}"><rect x="${Math.round(h.hour * column)}" y="0" width="${Math.ceil(
        column
      )}" height="${baseline}" fill="transparent"/><rect x="${x}" y="${baseline - barHeight}" width="${Math.floor(
        column - 4
      )}" height="${barHeight}" fill="${h === peak && h.minutes > 0 ? 'var(--break)' : '#5b7fa6'}"/></g>`;
    })
    .join('');
  const ticks = [0, 6, 12, 18, 23]
    .map((hour) => `<text x="${Math.round(hour * column + column / 2)}" y="${baseline + 14}" text-anchor="middle">${t('charts.hour', { hour })}</text>`)
    .join('');
  const axis = `<rect x="0" y="${baseline}" width="${width}" height="1" fill="var(--edge)"/>`;
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" height="${height}" role="img" aria-label="${esc(t('charts.hours'))}">${axis}${bars}${ticks}</svg>`;
};

// GitHub-style calendar: columns are weeks (Mon→Sun rows), one hue light→dark.
export const heatmap = (weeks: (DailyFocus | null)[][], goalMinutes: number, todayKey: string) => {
  const cell = 14;
  const gap = 3;
  const left = 22;
  const width = left + weeks.length * (cell + gap);
  const height = 7 * (cell + gap);

  const cells = weeks
    .flatMap((week, w) =>
      week.map((day, d) => {
        if (!day) return '';
        const x = left + w * (cell + gap);
        const y = d * (cell + gap);
        const level = heatLevel(day.minutes, goalMinutes);
        const outline = day.dateKey === todayKey ? 'stroke="var(--goal)" stroke-width="2"' : '';
        const tip = `${shortDate(day.dateKey)} (${weekdayOf(day.dateKey)}) · ${formatMinutes(day.minutes)}`;
        return `<rect data-tip="${esc(tip)}" x="${x}" y="${y}" width="${cell}" height="${cell}" fill="var(--heat-${level})" ${outline}/>`;
      })
    )
    .join('');
  const labels = [0, 2, 4]
    // Monday, Wednesday, Friday (5 January 1970 was a Monday)
    .map((d) => `<text x="0" y="${d * (cell + gap) + cell - 3}">${formatDate(Date.UTC(1970, 0, 5 + d), { weekday: 'narrow', timeZone: 'UTC' })}</text>`)
    .join('');

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(t('charts.heatmap', { count: weeks.length }))}">${labels}${cells}</svg>`;
};

export const heatLegend = () =>
  `<div class="legend">${esc(t('charts.less'))} ${[0, 1, 2, 3, 4].map((l) => `<i style="background:var(--heat-${l})"></i>`).join('')} ${esc(t('charts.more'))}</div>`;

// Two-part bar: done vs remaining.
export const splitBar = (done: number, total: number, color: string, tip: string, width = 220) => {
  const filled = total > 0 ? Math.round((width * Math.min(done, total)) / total) : 0;
  return `<svg class="chart" viewBox="0 0 ${width} 10" height="10" role="img" aria-label="${esc(tip)}" data-tip="${esc(tip)}">
    <rect x="0" y="0" width="${width}" height="10" fill="var(--well)" stroke="var(--shadow)" stroke-width="2"/>
    <rect x="0" y="0" width="${filled}" height="10" fill="${color}"/>
  </svg>`;
};

// One cell per estimated pomodoro; extra sessions beyond the estimate show in pink.
export const pomodoroCells = (done: number, estimate: number) => {
  const count = Math.max(done, estimate);
  const width = count * 8;
  const cells = Array.from({ length: count }, (_, i) => {
    const fill = i < done ? (i < estimate ? 'var(--focus)' : 'var(--long)') : 'var(--well)';
    const stroke = i < done ? '' : 'stroke="var(--edge)" stroke-width="1"';
    return `<rect x="${i * 8 + 0.5}" y="0.5" width="6" height="6" fill="${fill}" ${stroke}/>`;
  }).join('');
  return `<svg width="${width}" height="7" viewBox="0 0 ${width} 7" data-tip="${esc(t('charts.pomodoros', { done, estimate }))}">${cells}</svg>`;
};

export { esc };
