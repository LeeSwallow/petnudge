import type { MessageKey } from './ko';

// A message: text with {name} placeholders, or plural forms picked by the
// `count` param (Intl.PluralRules; `other` is required).
export type PluralMessage = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>;
export type Message = string | PluralMessage;
// Every catalog has exactly the Korean catalog's keys.
export type Catalog = Record<MessageKey, Message>;
