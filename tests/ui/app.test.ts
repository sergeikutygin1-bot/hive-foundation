// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createUi } from '../../src/ui/app';
import { showFatal, showOverlay } from '../../src/ui/fatal';
import { entitiesOf } from '../sim/helpers';
import { makeDeps } from './helpers';

function setup() {
  const { deps, state } = makeDeps();
  const container = document.createElement('div');
  const ui = createUi(container, deps);
  return { deps, state, container, ui };
}

describe('createUi', () => {
  it('turns game events into toasts', () => {
    const { container, ui } = setup();
    ui.handleEvent({ type: 'harvested', resource: 'honey_wildflower', amount: 1.5 });
    expect(container.querySelector('.toasts')!.textContent).toContain('+1.5 kg');
  });

  it('closes the topmost layer: inspect first, then the panel', () => {
    const { container, state, ui } = setup();
    container.querySelector<HTMLButtonElement>('.toolbar .hexbtn')!.click();
    const panel = container.querySelector<HTMLElement>('.panel-host')!;
    expect(panel.hidden).toBe(false);
    ui.openInspect(entitiesOf(state, 'hive')[0].id, { x: 10, y: 10 });
    expect(panel.hidden).toBe(true);
    expect(ui.closeTopmost()).toBe(true);
    expect(container.querySelector<HTMLElement>('.inspect')!.hidden).toBe(true);
    expect(ui.closeTopmost()).toBe(false);
  });

  it('shows and hides the cursor hint', () => {
    const { container, ui } = setup();
    ui.hint('Not enough coins', { x: 5, y: 6 }, 'invalid');
    const hint = container.querySelector<HTMLElement>('.cursor-hint')!;
    expect(hint.hidden).toBe(false);
    expect(hint.classList.contains('invalid')).toBe(true);
    expect(hint.style.left).toBe('5px');
    ui.hint(null, null, 'valid');
    expect(hint.hidden).toBe(true);
  });
});

describe('fatal screens', () => {
  it('renders an alert and a reloadable overlay', () => {
    const root = document.createElement('div');
    const fatal = showFatal(root, 'Title', 'Body');
    expect(fatal.getAttribute('role')).toBe('alert');
    expect(fatal.textContent).toContain('Title');
    const overlay = showOverlay(root, 'Graphics reset…', 'Reload');
    expect(overlay.querySelector('button')!.textContent).toBe('Reload');
  });
});
