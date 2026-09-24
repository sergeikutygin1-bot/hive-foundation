import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { Registry } from '../content/registry';
import type { GameState } from '../sim/state';
import type { EntitySync } from './sync';

interface Badge {
  anchor: CSS2DObject;
  badge: HTMLElement;
  fill: HTMLElement;
  label: HTMLElement;
  shown: string;
}

/** Fill-level label above each producer. HTML via CSS2DRenderer so text is crisp and shares the UI's CSS. */
export class BadgeLayer {
  private readonly badges = new Map<string, Badge>();

  get count(): number {
    return this.badges.size;
  }

  update(state: GameState, reg: Registry, entities: Pick<EntitySync, 'objectFor'>): void {
    const live = new Set<string>();
    for (const entity of Object.values(state.entities)) {
      const producer = reg.buildable(entity.def).producer;
      if (!producer) continue;
      live.add(entity.id);
      let b = this.badges.get(entity.id);
      if (!b) {
        const host = entities.objectFor(entity.id);
        if (!host) continue;
        b = this.create();
        host.add(b.anchor);
        this.badges.set(entity.id, b);
      }
      const fraction = Math.min(1, (entity.store ?? 0) / producer.capacity);
      const pct = `${Math.floor(fraction * 100)}%`;
      if (pct !== b.shown) {
        b.label.textContent = pct;
        b.fill.style.width = pct;
        b.shown = pct;
      }
      b.badge.classList.toggle('full', fraction >= 1);
    }
    for (const [id, b] of this.badges) {
      if (live.has(id)) continue;
      b.anchor.removeFromParent();
      this.badges.delete(id);
    }
  }

  private create(): Badge {
    // The CSS2DRenderer owns the anchor's transform, so animations go on the inner element.
    const anchorEl = document.createElement('div');
    anchorEl.className = 'badge-anchor';
    const badge = document.createElement('div');
    badge.className = 'badge';
    const label = document.createElement('span');
    label.className = 'badge-label';
    const bar = document.createElement('div');
    bar.className = 'badge-bar';
    const fill = document.createElement('div');
    fill.className = 'badge-fill';
    bar.append(fill);
    badge.append(label, bar);
    anchorEl.append(badge);
    const anchor = new CSS2DObject(anchorEl);
    anchor.position.set(0, 1.2, 0);
    return { anchor, badge, fill, label, shown: '' };
  }
}
