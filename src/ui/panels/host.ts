import { h, setText } from '../h';
import { t } from '../i18n';
import { icon } from '../icons';

export interface Panel {
  readonly title: string;
  readonly body: HTMLElement;
  update(): void;
  onOpen?(): void;
}

/** One panel open at a time, anchored above the toolbar. */
export class PanelHost {
  readonly el: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private current: Panel | null = null;

  constructor() {
    this.titleEl = h('h2', { id: 'panel-title' });
    this.bodyEl = h('div', { class: 'panel-body' });
    const closeButton = h('button', { class: 'iconbtn small', type: 'button', 'aria-label': t('panel.close') }, icon('close'));
    closeButton.addEventListener('click', () => this.close());
    this.el = h(
      'section',
      { class: 'panel-host', role: 'dialog', 'aria-labelledby': 'panel-title', hidden: true },
      h('div', { class: 'panel-head' }, this.titleEl, closeButton),
      this.bodyEl,
    );
  }

  get openPanel(): Panel | null {
    return this.current;
  }

  open(panel: Panel): void {
    this.current = panel;
    setText(this.titleEl, panel.title);
    this.bodyEl.replaceChildren(panel.body);
    this.el.hidden = false;
    panel.onOpen?.();
    panel.update();
  }

  toggle(panel: Panel): void {
    if (this.current === panel) this.close();
    else this.open(panel);
  }

  close(): boolean {
    if (!this.current) return false;
    this.current = null;
    this.el.hidden = true;
    this.bodyEl.replaceChildren();
    return true;
  }

  update(): void {
    this.current?.update();
  }
}
