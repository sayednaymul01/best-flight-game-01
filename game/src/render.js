// Coral Run — the renderer: sky, sun, fog and the chase camera that
// follows the plane without ever fighting the pilot.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { lerp } from './random.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  // Sky: a vertical gradient dome, warm near the horizon.
  const skyGeo = new THREE.SphereGeometry(4200, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2f6fb2) },
      mid: { value: new THREE.Color(0x8ec6e8) },
      low: { value: new THREE.Color(0xf6d9a0) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main() {
        float h = normalize(vPos).y;
        vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h))
                          : mix(low, mid, smoothstep(-0.08, 0.25, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'sky';
  scene.add(sky);

  // Sun: a bright disc low in the west, plus the light that shapes the land.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sun.position.set(-2600, 420, -1400);
  sun.lookAt(0, 0, 0);
  scene.add(sun);

  const hemi = new THREE.HemisphereLight(0xbdd9f2, 0x4a6b4a, 0.85);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xfff1d0, 1.6);
  dir.position.set(-800, 900, -500);
  scene.add(dir);

  scene.fog = new THREE.Fog(0x9fc3dd, 700, 3400);

  const camera = new THREE.PerspectiveCamera(
    68, window.innerWidth / window.innerHeight, 0.5, 6000,
  );

  const camState = { pos: new THREE.Vector3(0, 30, -30), look: new THREE.Vector3() };

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  // Chase camera: trails behind the plane's tail, eases into place, and
  // widens its field of view as the plane goes faster.
  function updateCamera(plane, dt, speedNorm) {
    const back = new THREE.Vector3(
      -Math.cos(plane.userData.heading) * CONFIG.camDistance,
      0,
      Math.sin(plane.userData.heading) * CONFIG.camDistance,
    );
    const target = plane.position.clone().add(back);
    target.y = plane.position.y + CONFIG.camHeight;
    const k = 1 - Math.exp(-CONFIG.camLag * dt);
    camState.pos.lerp(target, k);
    camState.look.lerp(plane.position, 1 - Math.exp(-8 * dt));
    camera.position.copy(camState.pos);
    camera.lookAt(camState.look.x, camState.look.y + 1, camState.look.z);
    camera.fov = lerp(68, 82, speedNorm);
    camera.updateProjectionMatrix();
  }

  return { renderer, scene, camera, updateCamera };
}
