import * as THREE from 'three';
import { HEX_SIZE, hexToWorld, type Hex } from '../core/hex';
import { palette } from './art/palette';

export type HighlightTone = 'hover' | 'valid' | 'invalid';

const TONE_COLORS: Record<HighlightTone, string> = {
  hover: palette.highlightHover,
  valid: palette.highlightValid,
  invalid: palette.highlightInvalid,
};
const MAX_RANGE = 64;

/** Pointy-top hex outline, just above the tile tops. */
function outlineGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 6; k++) {
    const a = THREE.MathUtils.degToRad(60 * k - 30);
    pts.push(new THREE.Vector3(Math.cos(a) * HEX_SIZE * 0.93, 0.03, Math.sin(a) * HEX_SIZE * 0.93));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

export class HexHighlight {
  readonly group = new THREE.Group();
  readonly cursor = new THREE.Group();
  readonly fillMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false });
  readonly range: THREE.InstancedMesh;
  currentTone: HighlightTone = 'hover';
  private readonly lineMaterial = new THREE.LineBasicMaterial();

  constructor() {
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(HEX_SIZE * 0.93, HEX_SIZE * 0.93, 0.02, 6), this.fillMaterial);
    fill.position.y = 0.02;
    const outline = new THREE.LineLoop(outlineGeometry(), this.lineMaterial);
    this.cursor.add(fill, outline);
    this.cursor.visible = false;

    const rangeMaterial = new THREE.MeshBasicMaterial({ color: palette.range, transparent: true, opacity: 0.25, depthWrite: false });
    this.range = new THREE.InstancedMesh(new THREE.CylinderGeometry(HEX_SIZE * 0.9, HEX_SIZE * 0.9, 0.015, 6), rangeMaterial, MAX_RANGE);
    this.range.visible = false;
    this.range.count = 0;

    this.group.add(this.cursor, this.range);
    this.setTone('hover');
  }

  show(h: Hex, tone: HighlightTone): void {
    const { x, z } = hexToWorld(h);
    this.cursor.position.set(x, 0, z);
    this.cursor.visible = true;
    this.setTone(tone);
  }

  hide(): void {
    this.cursor.visible = false;
  }

  showRange(hexes: readonly Hex[]): void {
    const m = new THREE.Matrix4();
    const n = Math.min(hexes.length, MAX_RANGE);
    for (let i = 0; i < n; i++) {
      const { x, z } = hexToWorld(hexes[i]);
      this.range.setMatrixAt(i, m.makeTranslation(x, 0.015, z));
    }
    this.range.count = n;
    this.range.instanceMatrix.needsUpdate = true;
    this.range.visible = n > 0;
  }

  clearRange(): void {
    this.range.visible = false;
    this.range.count = 0;
  }

  private setTone(tone: HighlightTone): void {
    this.currentTone = tone;
    this.fillMaterial.color.set(TONE_COLORS[tone]);
    this.lineMaterial.color.set(TONE_COLORS[tone]);
  }
}
