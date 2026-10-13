import { en, type MessageKey } from './en';

export type { MessageKey };
type Params = Record<string, string | number>;

const catalogs: Record<string, Partial<Record<MessageKey, string>>> = { en };
let locale = 'en';

export function setLocale(next: string): void {
  if (catalogs[next]) locale = next;
}

export function getLocale(): string {
  return locale;
}

export function isMessageKey(key: string): key is MessageKey {
  return key in en;
}

/** Translate a key with `{param}` interpolation. Unknown keys render as-is. */
export function t(key: MessageKey | string, params: Params = {}): string {
  const template = (isMessageKey(key) && (catalogs[locale]?.[key] ?? en[key])) || key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}
