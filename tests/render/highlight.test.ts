import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { hex } from '../../src/core/hex';
import { palette } from '../../src/render/art/palette';
import { HexHighlight } from '../../src/render/highlight';

describe('HexHighlight', () => {
  it('shows a tinted cursor on a hex and hides it', () => {
    const hl = new HexHighlight();
    hl.show(hex(1, 0), 'invalid');
    expect(hl.cursor.visible).toBe(true);
    expect(hl.cursor.position.x).toBeCloseTo(Math.sqrt(3));
    expect(hl.currentTone).toBe('invalid');
    expect(hl.fillMaterial.color.getHex()).toBe(new THREE.Color(palette.highlightInvalid).getHex());
    hl.hide();
    expect(hl.cursor.visible).toBe(false);
  });

  it('shows and clears a range', () => {
    const hl = new HexHighlight();
    hl.showRange([hex(0, 1), hex(1, 0)]);
    expect(hl.range.visible).toBe(true);
    expect(hl.range.count).toBe(2);
    hl.clearRange();
    expect(hl.range.visible).toBe(false);
  });
});
