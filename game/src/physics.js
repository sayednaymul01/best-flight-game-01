// Coral Run — the flight model. A forgiving arcade model with real
// trade-offs: throttle sets target speed, banking turns the plane, climbing
// bleeds speed, and dropping below flying speed stalls the wing.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp } from './random.js';
import { heightAt } from './terrain.js';

// Fresh flight state for a sortie starting on the runway.
export function freshState() {
  const rw = CONFIG.runway;
  return {
    pos: new THREE.Vector3(rw.x - rw.length / 2 + 20, 9.2, rw.z),
    heading: 0, // radians, 0 = east (+X), grows counter-clockwise
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: CONFIG.fuelMax,
    damage: 0,
    verticalSpeed: 0,
    onGround: true,
    crashed: false,
    landed: false,
    time: 0,
  };
}

// One fixed step of flight. Returns events the game loop reacts to:
// 'takeoff', 'crash-ground', 'crash-sea', 'landed', 'stalled'.
export function stepFlight(s, input, dt, wind) {
  const events = [];
  const prevY = s.pos.y;

  // Throttle: W/Shift spools up, S/Ctrl spools down.
  if (input.throttleUp) s.throttle = clamp(s.throttle + dt * 0.7, 0, 1);
  if (input.throttleDown) s.throttle = clamp(s.throttle - dt * 0.7, 0, 1);

  // Target speed follows the throttle; the plane accelerates toward it.
  const target = s.throttle * CONFIG.maxSpeed;
  const accel = s.speed < target ? CONFIG.accel : CONFIG.accel * 0.55;
  s.speed += clamp(target - s.speed, -accel * dt, accel * dt);
  s.speed = Math.max(0, s.speed);

  // Roll toward the input, then bank turns the heading.
  const targetRoll = input.roll * CONFIG.maxBank;
  s.roll += clamp(targetRoll - s.roll, -CONFIG.rollRate * dt, CONFIG.rollRate * dt);
  const turnAuthority = clamp(s.speed / CONFIG.cruiseSpeed, 0, 1.4);
  s.heading -= Math.sin(s.roll) * CONFIG.turnRate * turnAuthority * dt;

  // Pitch toward the input; climbing costs speed, diving gains it.
  const targetPitch = input.pitch * CONFIG.maxPitch;
  s.pitch += clamp(targetPitch - s.pitch, -CONFIG.pitchRate * dt, CONFIG.pitchRate * dt);
  if (s.pitch > 0.05) s.speed = Math.max(0, s.speed - CONFIG.climbBleed * s.pitch * dt);
  if (s.pitch < -0.05) s.speed = Math.min(CONFIG.maxSpeed, s.speed - CONFIG.diveGain * s.pitch * dt);

  // Lift: enough speed and the plane climbs with its pitch; too slow and
  // the wing stalls — the nose drops and the plane sinks.
  const flying = s.speed >= CONFIG.minFlySpeed;
  let climb;
  if (flying) {
    climb = Math.sin(s.pitch) * s.speed * 0.9;
  } else {
    climb = -CONFIG.gravity * 0.55;
    s.pitch += (0 - s.pitch) * dt * 0.8;
    if (s.speed < CONFIG.minFlySpeed * 0.6 && !s.onGround) events.push('stalled');
  }

  // Wind pushes the plane sideways; gusts are strongest in the storm sortie.
  const wx = wind ? wind.x : 0;
  const wz = wind ? wind.z : 0;

  // Integrate: forward along the heading, pitched up or down.
  const dir = new THREE.Vector3(
    Math.cos(s.heading) * Math.cos(s.pitch),
    Math.sin(s.pitch),
    -Math.sin(s.heading) * Math.cos(s.pitch),
  );
  s.pos.addScaledVector(dir, s.speed * dt);
  s.pos.y += climb * dt;
  s.pos.x += wx * dt;
  s.pos.z += wz * dt;
  s.verticalSpeed = (s.pos.y - prevY) / Math.max(dt, 1e-6);

  // Stay inside the world: a soft invisible wall far out at sea.
  const d = Math.hypot(s.pos.x, s.pos.z);
  if (d > 1600) {
    const k = 1600 / d;
    s.pos.x *= k;
    s.pos.z *= k;
  }
  s.pos.y = Math.min(s.pos.y, 420);

  // Fuel: burns with the throttle, idles gently on the ground.
  const burn = s.onGround && s.speed < 2
    ? CONFIG.fuelBurnIdle * 0.3
    : CONFIG.fuelBurnIdle + (CONFIG.fuelBurnFull - CONFIG.fuelBurnIdle) * s.throttle;
  s.fuel = Math.max(0, s.fuel - burn * dt);

  // Ground: the runway shelf is flat; everywhere else the terrain decides.
  const ground = heightAt(s.pos.x, s.pos.z);
  const rw = CONFIG.runway;
  const overRunway = Math.abs(s.pos.x - rw.x) < rw.length / 2
    && Math.abs(s.pos.z - rw.z) < rw.width / 2;
  const runwayTop = 7.6;
  const floorY = overRunway ? runwayTop : ground;

  if (s.onGround) {
    // Rolling on the runway or the beach: stay on the floor, speed decays
    // unless the throttle holds it, and pull up to lift off.
    s.pos.y = floorY + 1.6;
    s.pitch = 0;
    s.speed = Math.max(0, s.speed - 6 * dt);
    s.heading -= Math.sin(s.roll) * 0.25 * dt;
    if (s.speed < 1 && s.throttle < 0.05) s.speed = 0;
    if (s.speed > CONFIG.minFlySpeed && input.pitch > 0.3) {
      s.onGround = false;
      s.pos.y += 0.5;
      events.push('takeoff');
    }
  } else if (s.pos.y <= floorY + 1.6) {
    // Touchdown from the air: gentle and slow on the runway is a landing;
    // anything else is a crash.
    s.pos.y = floorY + 1.6;
    const sink = -s.verticalSpeed;
    if (overRunway && sink <= CONFIG.landingMaxSink && s.speed <= CONFIG.landingMaxSpeed) {
      s.onGround = true;
      s.landed = true;
      s.pitch = 0;
      events.push('landed');
    } else {
      s.crashed = true;
      s.damage = 100;
      events.push(floorY < 4 ? 'crash-sea' : 'crash-ground');
    }
  }

  s.time += dt;
  return events;
}
