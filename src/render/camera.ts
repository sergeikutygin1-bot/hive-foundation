import * as THREE from 'three';

export interface RigPose {
  targetX: number;
  targetZ: number;
  distance: number;
  /** Radians around the target; 0 = camera on +z looking toward -z. */
  yaw: number;
  /** Radians above the ground plane. */
  pitch: number;
}

export const PITCH = THREE.MathUtils.degToRad(50);
export const YAW_STEP = Math.PI / 3;
export const RIG_HOME = { targetX: 0, targetZ: 0, distance: 16 } as const;
export const RIG_LIMITS = { minDistance: 7, maxDistance: 34, maxTargetRadius: 16 } as const;

export function cameraPosition(p: RigPose): THREE.Vector3 {
  const horizontal = p.distance * Math.cos(p.pitch);
  return new THREE.Vector3(
    p.targetX + Math.sin(p.yaw) * horizontal,
    p.distance * Math.sin(p.pitch),
    p.targetZ + Math.cos(p.yaw) * horizontal,
  );
}

export function clampTarget(x: number, z: number, maxRadius: number): { x: number; z: number } {
  const d = Math.hypot(x, z);
  if (d <= maxRadius) return { x, z };
  return { x: (x / d) * maxRadius, z: (z / d) * maxRadius };
}

/** Ground-plane change of the target for a drag, so the ground under the cursor follows it. */
export function panDelta(dxPx: number, dyPx: number, p: RigPose, fovDeg: number, viewportHeightPx: number): { x: number; z: number } {
  const worldPerPx = (2 * p.distance * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)) / Math.max(viewportHeightPx, 1);
  const rightX = Math.cos(p.yaw);
  const rightZ = -Math.sin(p.yaw);
  const forwardX = -Math.sin(p.yaw);
  const forwardZ = -Math.cos(p.yaw);
  const across = -dxPx * worldPerPx;
  const along = (dyPx * worldPerPx) / Math.sin(p.pitch);
  return { x: across * rightX + along * forwardX, z: across * rightZ + along * forwardZ };
}

const EASED_KEYS = ['targetX', 'targetZ', 'distance', 'yaw'] as const;

/** Fixed-tilt orbit camera: drag pans, wheel zooms, Q/E rotates in hex-aligned 60° steps. */
export class CameraRig {
  readonly pose: RigPose;
  private readonly goal: RigPose;

  constructor(private readonly camera: THREE.PerspectiveCamera, initial: Partial<RigPose> = {}) {
    this.pose = { ...RIG_HOME, yaw: 0, pitch: PITCH, ...initial };
    this.goal = { ...this.pose };
    this.apply();
  }

  pan(dxPx: number, dyPx: number, viewportHeightPx: number): void {
    const d = panDelta(dxPx, dyPx, this.pose, this.camera.fov, viewportHeightPx);
    const t = clampTarget(this.pose.targetX + d.x, this.pose.targetZ + d.z, RIG_LIMITS.maxTargetRadius);
    this.pose.targetX = this.goal.targetX = t.x;
    this.pose.targetZ = this.goal.targetZ = t.z;
    this.apply();
  }

  zoom(deltaY: number): void {
    this.setDistance(this.goal.distance * Math.exp(deltaY * 0.0015));
  }

  /** Pinch: factor > 1 means fingers moved apart (zoom in). */
  zoomBy(factor: number): void {
    if (factor > 0) this.setDistance(this.goal.distance / factor);
  }

  rotate(dir: 1 | -1): void {
    this.goal.yaw += dir * YAW_STEP;
  }

  focus(x: number, z: number): void {
    const t = clampTarget(x, z, RIG_LIMITS.maxTargetRadius);
    this.goal.targetX = t.x;
    this.goal.targetZ = t.z;
  }

  reset(): void {
    this.goal.targetX = RIG_HOME.targetX;
    this.goal.targetZ = RIG_HOME.targetZ;
    this.goal.distance = RIG_HOME.distance;
    this.goal.yaw = Math.round(this.goal.yaw / (2 * Math.PI)) * 2 * Math.PI;
  }

  update(dtSec: number): void {
    const k = 1 - Math.exp(-dtSec * 10);
    for (const key of EASED_KEYS) {
      const diff = this.goal[key] - this.pose[key];
      this.pose[key] = Math.abs(diff) < 1e-4 ? this.goal[key] : this.pose[key] + diff * k;
    }
    this.apply();
  }

  private setDistance(d: number): void {
    this.goal.distance = THREE.MathUtils.clamp(d, RIG_LIMITS.minDistance, RIG_LIMITS.maxDistance);
  }

  private apply(): void {
    this.camera.position.copy(cameraPosition(this.pose));
    this.camera.lookAt(this.pose.targetX, 0, this.pose.targetZ);
    this.camera.updateMatrixWorld();
  }
}
