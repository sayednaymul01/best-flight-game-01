// Coral Run — the island. One height function drives both the visible
// terrain mesh and the flight model's ground collisions, so what you see
// is exactly what you can crash into.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { fbm, makeNoise2D, clamp, lerp } from './random.js';

const noise = makeNoise2D(1337);
const R = CONFIG.islandRadius;

// Ground height at (x, z). Sea floor is below the water outside the island.
export function heightAt(x, z) {
  const d = Math.hypot(x, z);
  const falloff = clamp(1 - d / R, 0, 1);
  const edge = falloff * falloff * (3 - 2 * falloff);
  let h = 14 + fbm(noise, x * 0.004 + 9, z * 0.004 + 3, 4) * 34;
  h += Math.max(0, fbm(noise, x * 0.0016 + 40, z * 0.0016 + 20, 3)) * 95;
  h *= edge;
  // The mountain in the north-west.
  const md = Math.hypot(x + 430, z + 380);
  h += Math.max(0, 1 - md / 260) * 120;
  // Flatten the runway shelf so takeoffs and landings are level.
  const rw = CONFIG.runway;
  const rx = Math.abs(x - rw.x) / (rw.length / 2 + 60);
  const rz = Math.abs(z - rw.z) / (rw.width / 2 + 70);
  const flat = clamp(1 - Math.max(rx, rz), 0, 1);
  h = lerp(h, 6, flat * flat);
  // Beach ring: sand where the island meets the sea.
  if (h < 7 && edge > 0.02) h = Math.max(h, 3.2);
  return h;
}

function terrainColor(h, d) {
  const sand = new THREE.Color(0xe8d29a);
  const grass = new THREE.Color(0x5da24a);
  const forest = new THREE.Color(0x2f6b34);
  const rock = new THREE.Color(0x8a7f74);
  const snow = new THREE.Color(0xf2f4f6);
  if (h < 5) return sand;
  if (h < 55) return grass.clone().lerp(forest, clamp((h - 18) / 40, 0, 1));
  if (h < 110) return forest.clone().lerp(rock, clamp((h - 80) / 40, 0, 1));
  return rock.clone().lerp(snow, clamp((h - 120) / 30, 0, 1));
}

export function buildTerrain(scene) {
  const group = new THREE.Group();
  group.name = 'island';

  // Heightfield: 128x128 segments over a 2200m square.
  const size = 2200;
  const seg = 128;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const c = terrainColor(h, Math.hypot(x, z));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const land = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  land.name = 'terrain';
  group.add(land);

  // Sea: a big calm plane with a slow swell in the shader-free version —
  // plain colour plus a second transparent sheet for sparkle.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000),
    new THREE.MeshPhongMaterial({ color: 0x1e6f8e, shininess: 120, specular: 0x99ccdd }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = CONFIG.seaLevel;
  sea.name = 'sea';
  group.add(sea);

  // Runway: dark asphalt strip with white centre dashes and threshold bars.
  const rw = CONFIG.runway;
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(rw.length, rw.width),
    new THREE.MeshLambertMaterial({ color: 0x2e3138 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(rw.x, 6.4, rw.z);
  strip.name = 'runway';
  group.add(strip);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5ee });
  for (let x = -rw.length / 2 + 18; x < rw.length / 2 - 10; x += 28) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.6), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(rw.x + x, 6.5, rw.z);
    group.add(dash);
  }
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(3, 14), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(rw.x + end * (rw.length / 2 - 8), 6.5, rw.z + k * 4.4);
      group.add(bar);
    }
  }

  // Windsock on a pole beside the runway, orange so it reads at a glance.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0xdddddd }),
  );
  pole.position.set(rw.x - 90, 12, rw.z - rw.width / 2 - 14);
  group.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 7, 10),
    new THREE.MeshLambertMaterial({ color: 0xff6a1a }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(rw.x - 90 + 3.5, 17.4, rw.z - rw.width / 2 - 14);
  sock.name = 'windsock';
  group.add(sock);

  // Hangar: a low red-roofed shed at the runway's west end.
  const hangar = new THREE.Group();
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(26, 9, 18),
    new THREE.MeshLambertMaterial({ color: 0xe8e2d4 }),
  );
  walls.position.y = 4.5;
  hangar.add(walls);
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 26, 12, 1, false, 0, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0xb03a2e }),
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 9;
  hangar.add(roof);
  hangar.position.set(rw.x - rw.length / 2 - 26, 6.4, rw.z + 26);
  hangar.name = 'hangar';
  group.add(hangar);

  // Palm trees scattered on the low ground: trunk + crossed fronds.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8f3a });
  const rand = (() => {
    let s = 777;
    return () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  })();
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2;
    const d = 120 + rand() * 700;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const h = heightAt(x, z);
    if (h < 6 || h > 60) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 9, 6), trunkMat);
    trunk.position.y = 4.5;
    trunk.rotation.z = (rand() - 0.5) * 0.25;
    tree.add(trunk);
    for (let f = 0; f < 5; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 5), frondMat);
      frond.position.y = 9.4;
      frond.rotation.z = Math.PI / 2.4;
      frond.rotation.y = (f / 5) * Math.PI * 2;
      frond.translateY(1.4);
      tree.add(frond);
    }
    tree.position.set(x, h, z);
    tree.scale.setScalar(0.9 + rand() * 0.7);
    group.add(tree);
  }

  // Clouds: soft white puffs drifting slowly over the island.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const clouds = new THREE.Group();
  clouds.name = 'clouds';
  for (let i = 0; i < 26; i++) {
    const puff = new THREE.Group();
    const n = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(9 + rand() * 12, 8, 6), cloudMat);
      s.position.set((rand() - 0.5) * 34, (rand() - 0.5) * 5, (rand() - 0.5) * 16);
      s.scale.y = 0.55;
      puff.add(s);
    }
    const a = rand() * Math.PI * 2;
    const d = rand() * 1100;
    puff.position.set(Math.cos(a) * d, 190 + rand() * 90, Math.sin(a) * d);
    puff.userData.drift = 1.5 + rand() * 2;
    clouds.add(puff);
  }
  group.add(clouds);
  group.userData.clouds = clouds;

  scene.add(group);
  return group;
}
