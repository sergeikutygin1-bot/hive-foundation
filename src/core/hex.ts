/** Axial hex coordinates, pointy-top layout. */
export interface Hex {
  readonly q: number;
  readonly r: number;
}
export type HexKey = string;

/** Distance from a hex center to one of its corners, in world units. */
export const HEX_SIZE = 1;

const SQRT3 = Math.sqrt(3);

/** Turns -0 into 0 so keys and deep equality stay stable. */
const norm = (n: number): number => (n === 0 ? 0 : n);

export function hex(q: number, r: number): Hex {
  return { q: norm(q), r: norm(r) };
}

export const ORIGIN: Hex = hex(0, 0);

export const HEX_DIRECTIONS: readonly Hex[] = [
  hex(1, 0), hex(1, -1), hex(0, -1), hex(-1, 0), hex(-1, 1), hex(0, 1),
];

export function hexKey(h: Hex): HexKey {
  return `${h.q},${h.r}`;
}

export function parseHexKey(key: HexKey): Hex {
  const [q, r] = key.split(',').map(Number);
  return hex(q, r);
}

export function hexAdd(a: Hex, b: Hex): Hex {
  return hex(a.q + b.q, a.r + b.r);
}

export function hexScale(h: Hex, k: number): Hex {
  return hex(h.q * k, h.r * k);
}

export function hexNeighbors(h: Hex): Hex[] {
  return HEX_DIRECTIONS.map((d) => hexAdd(h, d));
}

export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/** Hexes at exactly `radius` steps from `center`. */
export function hexRing(center: Hex, radius: number): Hex[] {
  if (radius === 0) return [hex(center.q, center.r)];
  const out: Hex[] = [];
  let cur = hexAdd(center, hexScale(HEX_DIRECTIONS[4], radius));
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      out.push(cur);
      cur = hexAdd(cur, HEX_DIRECTIONS[side]);
    }
  }
  return out;
}

/** Hexes within `radius` steps of `center`, center included. */
export function hexRange(center: Hex, radius: number): Hex[] {
  const out: Hex[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    const lo = Math.max(-radius, -dq - radius);
    const hi = Math.min(radius, -dq + radius);
    for (let dr = lo; dr <= hi; dr++) out.push(hex(center.q + dq, center.r + dr));
  }
  return out;
}

export function hexToWorld(h: Hex, size = HEX_SIZE): { x: number; z: number } {
  return { x: size * SQRT3 * (h.q + h.r / 2), z: size * 1.5 * h.r };
}

export function worldToHex(x: number, z: number, size = HEX_SIZE): Hex {
  const q = ((SQRT3 / 3) * x - z / 3) / size;
  const r = ((2 / 3) * z) / size;
  return hexRound(q, r);
}

export function hexRound(qf: number, rf: number): Hex {
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return hex(q, r);
}
