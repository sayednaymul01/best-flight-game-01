// Coral Run — staged scenes for the entry's screenshots. Each shot freezes
// the plane in a posed moment (chase view, ring ahead, HUD lit) so the
// screenshots show the game at its best. Only active with ?shot=N in the URL.
import * as THREE from 'three';
import { CONFIG } from './config.js';

// Pose the plane and the world for screenshot N. Returns true when staged.
export function stageShot(n, game) {
  const { state, plane, setMission } = game;
  if (n === 4) {
    // Parked on the runway: the courier on the strip, hangar beside it,
    // rings over the island ahead, instruments lit.
    setMission(0);
    game.setScreen('flying');
    state.pos.set(CONFIG.runway.x - 100, 9.2, CONFIG.runway.z);
    state.heading = 0;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0;
    state.onGround = true;
    state.fuel = 100;
    state.time = 0;
    game.score = 0;
    plane.position.copy(state.pos);
    plane.rotation.order = 'YXZ';
    plane.rotation.y = state.heading - Math.PI / 2;
    plane.rotation.x = 0;
    plane.rotation.z = 0;
    game.frozen = true;
    return true;
  }
  setMission(0);
  game.setScreen('flying');
  if (n === 1) {
    // Cover: chase view, first ring dead ahead, runway below to the left.
    state.pos.set(30, 62, 180);
    state.heading = -0.35;
    state.pitch = 0.02;
    state.roll = -0.12;
    state.speed = 58;
    state.throttle = 0.72;
  } else if (n === 2) {
    // Low banking turn over the beach, sea and palms behind.
    state.pos.set(-120, 34, 620);
    state.heading = 1.9;
    state.pitch = 0.04;
    state.roll = -0.55;
    state.speed = 74;
    state.throttle = 0.9;
  } else if (n === 3) {
    // Ring approach: lined up on the ring so it reads face-on, clear of the HUD.
    state.pos.set(60, 52, 230);
    state.heading = -0.85;
    state.pitch = 0.03;
    state.roll = 0.08;
    state.speed = 52;
    state.throttle = 0.65;
  } else {
    return false;
  }
  state.onGround = false;
  state.fuel = 78;
  state.time = 42;
  game.score = n === 1 ? 200 : 100;
  plane.position.copy(state.pos);
  // Yaw, then pitch, then roll — the same convention the live loop uses.
  plane.rotation.order = 'YXZ';
  plane.rotation.y = state.heading - Math.PI / 2;
  plane.rotation.x = state.pitch;
  plane.rotation.z = -state.roll;
  game.frozen = true;
  return true;
}

// Keep the frozen pose alive: spin the prop, drift the clouds.
export function tickFrozen(game, dt) {
  const { plane } = game;
  plane.userData.prop.rotation.z += dt * 40;
  const clouds = game.terrain.userData.clouds;
  if (clouds) {
    for (const puff of clouds.children) {
      puff.position.x += puff.userData.drift * dt;
      if (puff.position.x > 1300) puff.position.x = -1300;
    }
  }
}

export function shotParams() {
  const q = new URLSearchParams(window.location.search);
  const n = parseInt(q.get('shot') || '', 10);
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : 0;
}
