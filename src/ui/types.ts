import type { Registry } from '../content/registry';
import type { Command, CommandResult } from '../sim/commands';
import type { GameState } from '../sim/state';

/** Everything the UI may use. Injected by game/, so ui/ never imports game/ (layer rule). */
export interface UiDeps {
  reg: Registry;
  getState(): GameState;
  dispatch(cmd: Command): CommandResult;
  startPlacing(defId: string): void;
  resetView(): void;
  resetSave(): void;
}
