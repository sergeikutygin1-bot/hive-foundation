import { en } from './strings/en';

export type StringKey = keyof typeof en;
type Vars = Record<string, string | number>;

const table: Record<string, string> = en;

function fill(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Compile-time-checked lookup. */
export function t(key: StringKey, vars?: Vars): string {
  return fill(table[key], vars);
}

/** For keys built at runtime (def ids, resource ids). Falls back to the key itself. */
export function tx(key: string, vars?: Vars): string {
  const template = table[key];
  return template === undefined ? key : fill(template, vars);
}
