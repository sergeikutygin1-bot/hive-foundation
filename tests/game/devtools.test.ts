// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { installDevTools } from '../../src/game/devtools';
import { Session } from '../../src/game/session';
import { newGame, reg } from '../sim/helpers';

it('exposes a debug handle on window', () => {
  const session = new Session(reg, newGame(1), true);
  const view = {
    ctx: { renderer: { info: { render: { triangles: 12, calls: 3 } } } },
    hexToClient: vi.fn(() => ({ x: 1, y: 2 })),
  };
  installDevTools(session, view);
  const game = window.__game!;
  expect(game.state).toBe(session.state);
  game.advance(600);
  expect(session.state.clock.tick).toBe(600);
  expect(game.dispatch({ type: 'harvestAll' }).ok).toBe(true);
  expect(game.renderInfo()).toEqual({ triangles: 12, calls: 3 });
  expect(game.hexToClient(1, -1)).toEqual({ x: 1, y: 2 });
  expect(view.hexToClient).toHaveBeenCalledWith({ q: 1, r: -1 });
});
