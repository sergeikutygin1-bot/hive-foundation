import { vi } from 'vitest';
import { dispatch, type Command } from '../../src/sim/commands';
import type { UiDeps } from '../../src/ui/types';
import { newGame, reg } from '../sim/helpers';

export function makeDeps() {
  const state = newGame(1);
  const deps = {
    reg,
    getState: () => state,
    dispatch: vi.fn((cmd: Command) => dispatch(state, reg, cmd)),
    startPlacing: vi.fn(),
    resetView: vi.fn(),
    resetSave: vi.fn(),
  } satisfies UiDeps;
  return { deps, state };
}
