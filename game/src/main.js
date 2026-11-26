// Coral Run — the game loop and screen flow: title, flying, paused,
// crashed, landed and mission complete. Owns the plane, the mission and
// the score; the other modules own their own jobs.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp } from './random.js';
import { buildTerrain, heightAt } from './terrain.js';
import { buildAircraft, updateProp } from './aircraft.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { freshState, stepFlight } from './physics.js';
import { MISSIONS, buildRings, nextRing, ringPassed, stormWind } from './missions.js';
import { createHUD } from './hud.js';
import { createRenderer } from './render.js';
import { stageShot, tickFrozen, shotParams } from './shots.js';

const canvas = document.getElementById('game');
const { renderer, scene, camera, updateCamera } = createRenderer(canvas);
const terrain = buildTerrain(scene);
const plane = buildAircraft();
plane.rotation.order = 'YXZ';
plane.userData.heading = 0;
scene.add(plane);
scene.add(plane.userData.shadow);
const input = createInput(canvas);
const audio = createAudio();
const hud = createHUD();

const game = {
  screen: 'title',
  terrain,
  plane,
  state: freshState(),
  mission: MISSIONS[0],
  rings: null,
  ringGroup: null,
  score: 0,
  best: 0,
  frozen: false,
  prevPos: new THREE.Vector3(),
};

try {
  game.best = parseInt(localStorage.getItem('coral-run-best') || '0', 10) || 0;
} catch (err) {
  game.best = 0;
}

const screens = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  over: document.getElementById('screen-over'),
  done: document.getElementById('screen-done'),
};

function setScreen(name) {
  game.screen = name;
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', key !== name && name !== 'flying' && name !== 'paused');
    if (name === 'flying') el.classList.add('hidden');
    if (name === 'paused') el.classList.toggle('hidden', key !== 'pause');
  }
  document.getElementById('hud').classList.toggle(
    'hidden', name === 'title' && !game.frozen,
  );
}
game.setScreen = setScreen;

function setMission(i) {
  game.mission = MISSIONS[i];
  if (game.ringGroup) {
    scene.remove(game.ringGroup);
    game.ringGroup = null;
  }
  const built = buildRings(scene, game.mission);
  game.ringGroup = built.group;
  game.rings = built.rings;
  document.querySelectorAll('.mission-btn').forEach((b, k) => {
    b.classList.toggle('selected', k === i);
  });
  document.getElementById('mission-name').textContent = game.mission.name;
  document.getElementById('mission-tag').textContent = game.mission.tagline;
}
game.setMission = setMission;

function startMission(i) {
  audio.resume();
  setMission(i);
  game.state = freshState();
  game.state.fuel = game.mission.fuelStart;
  game.score = 0;
  game.prevPos.copy(game.state.pos);
  plane.position.copy(game.state.pos);
  plane.rotation.set(0, game.state.heading - Math.PI / 2, 0);
  setScreen('flying');
  hud.showMessage(`${game.mission.name} — ${game.mission.tagline}`, 4);
}

function endRun(title, lines, won) {
  const over = screens.over;
  const done = screens.done;
  const target = won ? done : over;
  const other = won ? over : done;
  other.classList.add('hidden');
  target.classList.remove('hidden');
  target.querySelector('.end-title').textContent = title;
  target.querySelector('.end-lines').innerHTML = lines.map((l) => `<p>${l}</p>`).join('');
  target.querySelector('.end-score').textContent = `Score ${game.score.toLocaleString('en-US')} · Best ${Math.max(game.best, game.score).toLocaleString('en-US')}`;
  if (game.score > game.best) {
    game.best = game.score;
    try { localStorage.setItem('coral-run-best', String(game.best)); } catch (err) { /* private mode */ }
  }
  setScreen(won ? 'done' : 'over');
  document.getElementById('hud').classList.add('hidden');
}

function crashRun(kind) {
  audio.crash();
  audio.update(0, 0, false);
  const why = kind === 'crash-sea'
    ? 'You ditched in the sea — the courier floats, but the mail does not.'
    : 'You hit the ground. The island keeps what it catches.';
  endRun('Crashed', [why, `Rings flown: ${game.rings.filter((r) => r.userData.passed).length} of ${game.rings.length}`], false);
}

function completeRun(landedBonus) {
  const mission = game.mission;
  const timeLeft = Math.max(0, mission.timeLimit - game.state.time);
  const timeBonus = Math.round(timeLeft) * CONFIG.timeBonusPerSecond;
  game.score += timeBonus + (landedBonus || 0);
  audio.land();
  const lines = [
    `${mission.name} complete — every ring flown.`,
    `Time bonus: +${timeBonus}`,
  ];
  if (landedBonus) lines.push(`Smooth landing: +${landedBonus}`);
  endRun('Mission Complete', lines, true);
}

// Title-screen mission buttons and keys.
document.querySelectorAll('.mission-btn').forEach((b) => {
  b.addEventListener('click', () => {
    audio.resume();
    setMission(parseInt(b.dataset.mission, 10));
  });
});
document.getElementById('btn-fly').addEventListener('click', () => {
  const sel = document.querySelector('.mission-btn.selected');
  startMission(sel ? parseInt(sel.dataset.mission, 10) : 0);
});
document.getElementById('btn-retry').addEventListener('click', () => startMission(game.mission.id));
document.getElementById('btn-again').addEventListener('click', () => startMission(game.mission.id));
document.getElementById('btn-menu').addEventListener('click', () => {
  setMission(game.mission.id);
  game.state = freshState();
  setScreen('title');
});
document.getElementById('btn-resume').addEventListener('click', () => setScreen('flying'));
document.getElementById('btn-quit').addEventListener('click', () => {
  setMission(game.mission.id);
  game.state = freshState();
  setScreen('title');
});

setMission(0);
setScreen('title');

// Screenshot staging: ?shot=1..4 poses the game and reports readiness.
const shot = shotParams();
let shotReady = false;
if (shot) {
  const ok = stageShot(shot, game);
  if (ok) {
    // Snap the camera behind the plane so the first frame is the shot.
    plane.userData.heading = game.state.heading;
    updateCamera(plane, 1, game.state.speed / CONFIG.maxSpeed);
    shotReady = true;
  }
}

const clock = new THREE.Clock();
let frames = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  frames++;

  // Global keys, whatever the screen.
  if (input.wasPressed('KeyM')) {
    const muted = audio.toggleMute();
    hud.showMessage(muted ? 'Sound off' : 'Sound on', 1.2);
  }
  if (game.screen === 'title') {
    if (input.wasPressed('Digit1')) setMission(0);
    if (input.wasPressed('Digit2')) setMission(1);
    if (input.wasPressed('Digit3')) setMission(2);
    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      const sel = document.querySelector('.mission-btn.selected');
      startMission(sel ? parseInt(sel.dataset.mission, 10) : 0);
    }
  }
  if (game.screen === 'flying' && input.wasPressed('KeyP')) setScreen('paused');
  else if (game.screen === 'paused' && input.wasPressed('KeyP')) setScreen('flying');
  if ((game.screen === 'over' || game.screen === 'done') && input.wasPressed('KeyR')) {
    startMission(game.mission.id);
  }
  if (game.screen === 'flying' && input.wasPressed('KeyR')) startMission(game.mission.id);
  input.clearPressed();

  if (game.frozen) {
    tickFrozen(game, dt);
    updateCamera(plane, dt, game.state.speed / CONFIG.maxSpeed);
    hud.update(game.state, game.mission, nextRing(game.rings), Math.max(0, game.mission.timeLimit - game.state.time), game.score);
    hud.drawMinimap(game.state, game.rings);
    renderer.render(scene, camera);
    if (shotReady && frames > 5) window.__shotReady = true;
    return;
  }

  // Clouds drift, always.
  const clouds = terrain.userData.clouds;
  if (clouds) {
    for (const puff of clouds.children) {
      puff.position.x += puff.userData.drift * dt;
      if (puff.position.x > 1300) puff.position.x = -1300;
    }
  }

  if (game.screen === 'flying') {
    input.poll();
    const s = game.state;
    const wind = stormWind(s.time, game.mission.wind);
    game.prevPos.copy(s.pos);
    const events = stepFlight(s, input, dt, wind);

    // Ring crossings.
    const target = nextRing(game.rings);
    if (target && ringPassed(target, s.pos, game.prevPos)) {
      target.userData.passed = true;
      target.material.color.set(0x37d67a);
      game.score += CONFIG.pointsPerRing;
      s.fuel = Math.min(CONFIG.fuelMax, s.fuel + CONFIG.fuelPerRing);
      audio.ring();
      hud.showBanner(`RING ${target.userData.index + 1} — +${CONFIG.pointsPerRing}`);
      hud.showMessage(`Ring ${target.userData.index + 1} of ${game.rings.length} — nice flying`, 2);
    }

    // Fuel out: the engine quits and the plane glides to whatever is below.
    if (s.fuel <= 0 && s.throttle > 0) {
      s.throttle = 0;
      hud.showMessage('OUT OF FUEL — find the runway or the beach', 4);
    }

    // Clock.
    const timeLeft = game.mission.timeLimit - s.time;
    if (timeLeft <= 0) {
      endRun("Time's Up", ['The clock ran out before the last ring.', `Rings flown: ${game.rings.filter((r) => r.userData.passed).length} of ${game.rings.length}`], false);
    }

    for (const ev of events) {
      if (ev === 'takeoff') hud.showMessage('Airborne — gear up, enjoy the island', 2.5);
      if (ev === 'stalled') hud.showMessage('STALL — nose down, build speed', 2);
      if (ev === 'landed') {
        if (game.mission.needsLanding && !nextRing(game.rings)) {
          completeRun(CONFIG.landingBonus);
        } else {
          hud.showMessage('Touchdown — throttle up to take off again', 3);
          audio.land();
        }
      }
      if (ev === 'crash-ground' || ev === 'crash-sea') crashRun(ev);
    }

    // Mission complete without a landing: all rings flown.
    if (!game.mission.needsLanding && game.rings.every((r) => r.userData.passed)
      && game.screen === 'flying') {
      completeRun(0);
    }

    // Sync the visible plane to the flight state.
    plane.position.copy(s.pos);
    plane.rotation.y = s.heading - Math.PI / 2;
    plane.rotation.x = s.pitch;
    plane.rotation.z = -s.roll;
    plane.userData.heading = s.heading;
    updateProp(plane, s.throttle, dt, s.fuel > 0);

    // Blob shadow under the plane.
    const shadow = plane.userData.shadow;
    const groundY = s.onGround ? s.pos.y - 1.6 : heightAt(s.pos.x, s.pos.z);
    shadow.position.set(s.pos.x, groundY + 0.15, s.pos.z);
    const hAbove = Math.max(0, s.pos.y - groundY);
    shadow.material.opacity = clamp(0.28 - hAbove * 0.0012, 0.04, 0.28);
    shadow.scale.setScalar(clamp(1.4 - hAbove * 0.002, 0.5, 1.4));

    audio.update(s.throttle, clamp(s.speed / CONFIG.maxSpeed, 0, 1), !s.onGround);
    hud.update(s, game.mission, nextRing(game.rings), Math.max(0, timeLeft), game.score);
    hud.drawMinimap(s, game.rings);
    hud.tick(dt);
    updateCamera(plane, dt, clamp(s.speed / CONFIG.maxSpeed, 0, 1));
  } else if (game.screen === 'title') {
    // Title screen: the camera slowly orbits the parked plane.
    const t = performance.now() * 0.00008;
    const px = game.state.pos.x;
    const pz = game.state.pos.z;
    camera.position.set(px + Math.cos(t) * 26, 15, pz + Math.sin(t) * 26);
    camera.lookAt(px, 9, pz);
    updateProp(plane, 0, dt, false);
  }

  renderer.render(scene, camera);
  if (shotReady && frames > 5) window.__shotReady = true;
}

animate();

// Read-only handle for play-testing: the live game object.
window.__coral = game;

// Announce readiness for the harness: no page errors in the first frames.
window.addEventListener('error', (e) => {
  window.__pageError = String(e.message || e.error || 'page error');
});
