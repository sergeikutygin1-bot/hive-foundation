import * as THREE from 'three';
import { makeHive, makeHouse } from './buildings';
import { makeFlowerBed } from './flowerbed';
import { solidMaterial } from './materials';

/**
 * Content def id -> 3D object. Deliberately source-agnostic (spec §6.4): a later sub-project can
 * register a factory that loads a .glb model for any def id without touching sim, ui or sync.
 */
export type ArtFactory = () => THREE.Object3D;

const factories = new Map<string, ArtFactory>();

export function registerArt(defId: string, factory: ArtFactory): void {
  factories.set(defId, factory);
}

export function hasArt(defId: string): boolean {
  return factories.has(defId);
}

export function createArt(defId: string): THREE.Object3D {
  const factory = factories.get(defId);
  if (!factory) throw new Error(`No art registered for "${defId}"`);
  const obj = factory();
  obj.userData.defId = defId;
  return obj;
}

export function meshOf(geometry: THREE.BufferGeometry): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, solidMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Geometry is built once and shared by every instance of a def. */
export function registerDefaultArt(): void {
  const house = makeHouse();
  const hive = makeHive();
  const wildflowerBed = makeFlowerBed('wildflower');
  registerArt('house', () => meshOf(house));
  registerArt('hive', () => meshOf(hive));
  registerArt('bed_wildflower', () => meshOf(wildflowerBed));
}
