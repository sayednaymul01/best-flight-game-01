// Coral Run — the courier plane, built from primitives so it reads as a
// built aircraft: fuselage, wings, tail, a spinning prop and nav lights.
import * as THREE from 'three';

export function buildAircraft() {
  const plane = new THREE.Group();
  plane.name = 'courier-plane';

  const cream = new THREE.MeshLambertMaterial({ color: 0xf3e6c8 });
  const red = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const glass = new THREE.MeshPhongMaterial({
    color: 0x9fd8e8, shininess: 140, specular: 0xffffff,
  });

  // Fuselage: a tapered tube along Z, nose forward (-Z in plane space).
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.55, 6.4, 12), cream);
  body.rotation.x = Math.PI / 2;
  plane.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), red);
  nose.position.z = -3.2;
  nose.scale.set(1, 1, 0.8);
  plane.add(nose);

  // Canopy: a glass bubble the pilot sits under.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 10), glass);
  canopy.position.set(0, 0.75, -1.1);
  canopy.scale.set(1, 0.75, 1.7);
  plane.add(canopy);

  // Main wing: wide, slightly swept, red tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.22, 1.9), cream);
  wing.position.set(0, -0.1, -0.4);
  plane.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.26, 1.9), red);
    tip.position.set(side * 5.2, -0.1, -0.4);
    plane.add(tip);
  }

  // Tail: horizontal stabiliser plus a red vertical fin with a white stripe.
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 1.1), cream);
  tail.position.set(0, 0.15, 2.9);
  plane.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.7, 1.5), red);
  fin.position.set(0, 0.9, 2.9);
  plane.add(fin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 1.5), cream);
  stripe.position.set(0, 1.1, 2.9);
  plane.add(stripe);

  // Propeller: hub plus two blades that spin with throttle.
  const prop = new THREE.Group();
  prop.position.set(0, 0, -3.9);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), dark);
  prop.add(hub);
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.1), dark);
    blade.rotation.z = a;
    prop.add(blade);
  }
  plane.add(prop);

  // Landing gear: two fixed wheels, visible on the runway.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark);
    leg.position.set(side * 1.1, -1.15, -0.6);
    plane.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.1, -1.7, -0.6);
    plane.add(wheel);
  }

  // Nav lights: red left, green right, white tail — small emissive bulbs.
  const light = (color, x, y, z) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color }),
    );
    m.position.set(x, y, z);
    plane.add(m);
    return m;
  };
  light(0xff2222, -5.7, -0.1, -0.4);
  light(0x22ff66, 5.7, -0.1, -0.4);
  light(0xffffff, 0, 0.3, 3.4);

  // A soft blob shadow that follows the plane over the ground.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.name = 'blob-shadow';

  plane.userData.prop = prop;
  plane.userData.shadow = shadow;
  return plane;
}

// Spin the prop faster with throttle; hide it when the engine is off.
export function updateProp(plane, throttle, dt, running) {
  const prop = plane.userData.prop;
  prop.rotation.z += dt * (4 + throttle * 55) * (running ? 1 : 0.15);
}
