// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createFpsMeter } from '../../src/game/fps';

it('reports frames per second every half second', () => {
  const meter = createFpsMeter();
  for (let i = 0; i < 30; i++) meter.frame(1 / 60);
  expect(meter.el.textContent).toBe('60 fps');
});
