import * as THREE from 'three';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfe8f3');
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 3, 4);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight('#ffffff', '#6b8f4e', 1.2));
const sun = new THREE.DirectionalLight('#fff4e0', 2);
sun.position.set(3, 5, 2);
scene.add(sun);

const prism = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1, 0.3, 6),
  new THREE.MeshLambertMaterial({ color: '#9bd16a', flatShading: true }),
);
scene.add(prism);

renderer.setAnimationLoop((timeMs) => {
  prism.rotation.y = timeMs / 2000;
  renderer.render(scene, camera);
});
