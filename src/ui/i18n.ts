import { createSubscriber } from 'svelte/reactivity';
import * as i18n from '../i18n';
import type { MessageKey, Params } from '../i18n';

// The i18n runtime (src/i18n) for Svelte: every call here subscribes the
// view that makes it to the locale, so a change of language re-renders the
// panel, the dock and the bubbles without a reload. Outside a Svelte effect
// (tests, plain DOM code) these are the plain functions.
const track = createSubscriber((update) => i18n.onLocaleChange(update));

export const t = (key: MessageKey, params?: Params) => {
  track();
  return i18n.t(key, params);
};

export const locale = () => {
  track();
  return i18n.getLocale();
};

export const formatDate = (date: Date | number, options: Intl.DateTimeFormatOptions) => {
  track();
  return i18n.formatDate(date, options);
};

export const formatTime = (date: Date | number) => {
  track();
  return i18n.formatTime(date);
};

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
  track();
  return i18n.formatNumber(value, options);
};

export const formatRelative = (value: number, unit: Intl.RelativeTimeFormatUnit) => {
  track();
  return i18n.formatRelative(value, unit);
};

export const formatMinutes = (minutes: number) => {
  track();
  return i18n.formatMinutes(minutes);
};

export type { MessageKey, Params };
