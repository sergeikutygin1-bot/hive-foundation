import type { Hex } from '../core/hex';
import type { Command, CommandResult } from '../sim/commands';
import type { GameState } from '../sim/state';
import type { Session } from './session';

export interface DevHandle {
  readonly state: GameState;
  dispatch(cmd: Command): CommandResult;
  advance(ticks: number): void;
  renderInfo(): { triangles: number; calls: number };
  hexToClient(q: number, r: number): { x: number; y: number };
}

declare global {
  interface Window {
    __game?: DevHandle;
  }
}

/** The subset of WorldView the dev handle needs (kept structural so tests can fake it). */
interface DevView {
  ctx: { renderer: { info: { render: { triangles: number; calls: number } } } };
  hexToClient(h: Hex): { x: number; y: number };
}

/** Dev builds only: a console/Playwright handle on the running game. */
export function installDevTools(session: Session, view: DevView): void {
  window.__game = {
    get state() {
      return session.state;
    },
    dispatch: (cmd) => session.dispatch(cmd),
    advance: (ticks) => session.step(ticks),
    renderInfo: () => {
      const { triangles, calls } = view.ctx.renderer.info.render;
      return { triangles, calls };
    },
    hexToClient: (q, r) => view.hexToClient({ q, r }),
  };
}
