import * as THREE from 'three';

/** Soft sky fill plus one shadow-casting sun covering the whole map (radius ~21 world units). */
export function addLights(scene: THREE.Scene): THREE.DirectionalLight {
  scene.add(new THREE.HemisphereLight('#fdf6e3', '#9ab87a', 1.5));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.0);
  sun.position.set(-8, 16, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  const r = 22;
  cam.left = -r;
  cam.right = r;
  cam.top = r;
  cam.bottom = -r;
  cam.near = 1;
  cam.far = 60;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  return sun;
}
