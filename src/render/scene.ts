import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { palette } from './art/palette';

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  labels: CSS2DRenderer;
  resize(): void;
  render(): void;
  dispose(): void;
}

export function createScene(container: HTMLElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'world-canvas';
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'world-labels';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(palette.fog, 40, 75);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

  const resize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  return {
    renderer,
    scene,
    camera,
    labels,
    resize,
    render() {
      renderer.render(scene, camera);
      labels.render(scene, camera);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
