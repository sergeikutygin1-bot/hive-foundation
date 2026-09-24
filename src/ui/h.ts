type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown>;

/**
 * Tiny element builder:
 * - `class` sets className
 * - `on*` functions become listeners
 * - `true` sets an empty attribute
 * - `false`, `null` and `undefined` are skipped
 */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') el.className = String(value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value as EventListener);
      else el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/** Avoids needless DOM writes when a value hasn't changed (the HUD updates every tick). */
export function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}
