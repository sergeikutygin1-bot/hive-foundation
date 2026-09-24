import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CameraRig, PITCH, RIG_HOME, RIG_LIMITS, YAW_STEP, cameraPosition, clampTarget, panDelta, type RigPose,
} from '../../src/render/camera';

const pose = (over: Partial<RigPose> = {}): RigPose => ({ targetX: 0, targetZ: 0, distance: 10, yaw: 0, pitch: PITCH, ...over });

describe('camera math', () => {
  it('sits behind and above the target at yaw 0', () => {
    const p = cameraPosition(pose());
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10 * Math.sin(PITCH));
    expect(p.z).toBeCloseTo(10 * Math.cos(PITCH));
  });

  it('orbits the target with yaw', () => {
    const p = cameraPosition(pose({ yaw: Math.PI / 2 }));
    expect(p.x).toBeCloseTo(10 * Math.cos(PITCH));
    expect(p.z).toBeCloseTo(0);
  });

  it('clamps the target to a disc', () => {
    expect(clampTarget(3, 4, 10)).toEqual({ x: 3, z: 4 });
    const c = clampTarget(30, 40, 10);
    expect(c.x).toBeCloseTo(6);
    expect(c.z).toBeCloseTo(8);
  });

  it('pans so the ground follows the cursor', () => {
    const right = panDelta(100, 0, pose(), 38, 800);
    expect(right.x).toBeLessThan(0);
    expect(right.z).toBeCloseTo(0);
    const down = panDelta(0, 100, pose(), 38, 800);
    expect(down.x).toBeCloseTo(0);
    expect(down.z).toBeLessThan(0);
    const rotated = panDelta(100, 0, pose({ yaw: Math.PI / 2 }), 38, 800);
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.z).toBeGreaterThan(0);
  });
});

describe('CameraRig', () => {
  const make = () => {
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    return { camera, rig: new CameraRig(camera) };
  };

  it('looks at its target', () => {
    const { camera, rig } = make();
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const toTarget = new THREE.Vector3(rig.pose.targetX, 0, rig.pose.targetZ).sub(camera.position).normalize();
    expect(dir.dot(toTarget)).toBeCloseTo(1, 5);
  });

  it('rotates in 60° steps with easing', () => {
    const { rig } = make();
    rig.rotate(1);
    rig.update(0.016);
    expect(rig.pose.yaw).toBeGreaterThan(0);
    expect(rig.pose.yaw).toBeLessThan(YAW_STEP);
    rig.update(10);
    expect(rig.pose.yaw).toBeCloseTo(YAW_STEP);
  });

  it('clamps zoom', () => {
    const { rig } = make();
    rig.zoom(100_000);
    rig.update(10);
    expect(rig.pose.distance).toBeCloseTo(RIG_LIMITS.maxDistance);
    rig.zoomBy(1_000);
    rig.update(10);
    expect(rig.pose.distance).toBeCloseTo(RIG_LIMITS.minDistance);
  });

  it('keeps panning inside the map', () => {
    const { rig } = make();
    for (let i = 0; i < 50; i++) rig.pan(-10_000, 0, 800);
    expect(Math.hypot(rig.pose.targetX, rig.pose.targetZ)).toBeLessThanOrEqual(RIG_LIMITS.maxTargetRadius + 1e-9);
  });

  it('reset eases back home', () => {
    const { rig } = make();
    rig.pan(300, 120, 800);
    rig.rotate(1);
    rig.zoom(500);
    rig.reset();
    rig.update(10);
    expect(rig.pose.targetX).toBeCloseTo(RIG_HOME.targetX);
    expect(rig.pose.targetZ).toBeCloseTo(RIG_HOME.targetZ);
    expect(rig.pose.distance).toBeCloseTo(RIG_HOME.distance);
    expect(Math.cos(rig.pose.yaw)).toBeCloseTo(1);
  });
});
