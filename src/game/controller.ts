import { hexKey, hexRange, type Hex } from '../core/hex';
import type { Registry } from '../content/registry';
import { COINS } from '../content/types';
import type { CameraRig } from '../render/camera';
import type { Ghost } from '../render/ghost';
import type { HexHighlight } from '../render/highlight';
import { validatePlace, type Command, type CommandResult } from '../sim/commands';
import { canAfford } from '../sim/economy';
import type { Entity, GameState, Speed } from '../sim/state';
import type { Ui } from '../ui/app';
import { reasonText } from '../ui/feedback';
import { showsAsZeroKg } from '../ui/format';
import { t, tx } from '../ui/i18n';
import { readyToHarvest } from '../ui/toolbar';

export type Mode = { kind: 'idle' } | { kind: 'placing'; def: string };
type Point = { x: number; y: number };

export interface ControllerDeps {
  reg: Registry;
  getState(): GameState;
  dispatch(cmd: Command): CommandResult;
  view: {
    highlight: Pick<HexHighlight, 'show' | 'hide' | 'showRange' | 'clearRange'>;
    ghost: Pick<Ghost, 'show' | 'hide'>;
    rig: Pick<CameraRig, 'rotate'>;
  };
  ui: Pick<Ui, 'toast' | 'closeTopmost' | 'openInspect' | 'closeInspect' | 'hint'>;
}

const SPEED_KEYS: Readonly<Record<string, Speed>> = { '1': 1, '2': 2, '3': 4 };

function entityAt(state: GameState, h: Hex): Entity | undefined {
  const id = state.tiles[hexKey(h)]?.entityId;
  return id ? state.entities[id] : undefined;
}

function rangeAround(center: Hex, range: number): Hex[] {
  return hexRange(center, range).filter((x) => x.q !== center.q || x.r !== center.r);
}

/** Turns pointer and keyboard input into commands and view feedback (spec §7.3, §7.6). */
export class Controller {
  private current: Mode = { kind: 'idle' };
  private lastSpeed: Speed = 1;

  constructor(private readonly deps: ControllerDeps) {}

  get mode(): Mode {
    return this.current;
  }

  startPlacing(defId: string): void {
    this.current = { kind: 'placing', def: defId };
    this.deps.ui.closeInspect();
  }

  cancel(): void {
    this.current = { kind: 'idle' };
    this.deps.view.ghost.hide();
    this.deps.view.highlight.clearRange();
    this.deps.ui.hint(null, null, 'valid');
  }

  hover(h: Hex | null, at: Point | null): void {
    const { view, ui, reg } = this.deps;
    view.highlight.clearRange();
    if (!h) {
      view.highlight.hide();
      view.ghost.hide();
      ui.hint(null, null, 'valid');
      return;
    }
    const state = this.deps.getState();
    if (this.current.kind === 'placing') {
      const def = reg.buildable(this.current.def);
      const reason = validatePlace(state, reg, def.id, h);
      const valid = reason === null;
      view.ghost.show(def.id, h, valid);
      view.highlight.show(h, valid ? 'valid' : 'invalid');
      if (def.producer) view.highlight.showRange(rangeAround(h, def.producer.range));
      const text = reason === null
        ? t('hint.place', { name: tx(`def.${def.id}`), coins: def.cost[COINS] ?? 0 })
        : reasonText(reason);
      ui.hint(text, at, valid ? 'valid' : 'invalid');
      return;
    }
    view.highlight.show(h, 'hover');
    const entity = entityAt(state, h);
    const producer = entity ? reg.buildable(entity.def).producer : undefined;
    if (entity && producer) view.highlight.showRange(rangeAround(entity.hex, producer.range));
  }

  click(h: Hex | null, at: Point | null): void {
    if (this.current.kind === 'placing') {
      if (!h) return;
      const def = this.deps.reg.buildable(this.current.def);
      const result = this.deps.dispatch({ type: 'place', def: def.id, hex: h });
      if (result.ok && !canAfford(this.deps.getState().inventory, def.cost)) this.cancel();
      else this.hover(h, at);
      return;
    }
    const entity = h ? entityAt(this.deps.getState(), h) : undefined;
    if (entity && at) this.deps.ui.openInspect(entity.id, at);
    else this.deps.ui.closeInspect();
  }

  key(key: string): boolean {
    switch (key) {
      case 'Escape':
        if (this.current.kind === 'placing') {
          this.cancel();
          return true;
        }
        return this.deps.ui.closeTopmost();
      case ' ': {
        const speed = this.deps.getState().clock.speed;
        if (speed === 0) {
          this.deps.dispatch({ type: 'setSpeed', speed: this.lastSpeed });
        } else {
          this.lastSpeed = speed;
          this.deps.dispatch({ type: 'setSpeed', speed: 0 });
        }
        return true;
      }
      case 'h':
      case 'H':
        // Same rule as the Harvest All button: nothing visible, nothing to harvest.
        if (!showsAsZeroKg(readyToHarvest(this.deps.reg, this.deps.getState()))) this.deps.dispatch({ type: 'harvestAll' });
        return true;
      case 'q':
      case 'Q':
        this.deps.view.rig.rotate(-1);
        return true;
      case 'e':
      case 'E':
        this.deps.view.rig.rotate(1);
        return true;
      default: {
        const speed = SPEED_KEYS[key];
        if (speed === undefined) return false;
        this.lastSpeed = speed;
        this.deps.dispatch({ type: 'setSpeed', speed });
        return true;
      }
    }
  }
}
