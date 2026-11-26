// Coral Run — shared tuning constants. One place for every number the
// flight model, the missions and the HUD agree on, so a tweak lands once.
export const CONFIG = {
  // Island and world
  islandRadius: 950, // metres from the island centre to the sea
  seaLevel: 0,
  maxTerrainHeight: 150,

  // Runway (flat strip near the south shore, along the X axis)
  runway: { x: 0, z: 460, length: 320, width: 26, heading: 0 },

  // Aircraft performance
  maxSpeed: 92, // m/s at full throttle
  cruiseSpeed: 55,
  minFlySpeed: 19, // below this the wing stops flying
  accel: 14, // m/s^2 toward the throttle's target speed
  climbBleed: 6, // speed lost per second while climbing hard
  diveGain: 9, // speed gained per second while diving
  rollRate: 1.9, // rad/s at full roll input
  maxBank: 1.05, // rad of bank
  pitchRate: 1.1, // rad/s at full pitch input
  maxPitch: 0.62,
  turnRate: 0.85, // yaw rad/s at full bank
  gravity: 9.8,

  // Fuel and damage
  fuelMax: 100,
  fuelBurnFull: 0.62, // units per second at full throttle
  fuelBurnIdle: 0.12,
  fuelPerRing: 5, // fuel refund for each ring flown
  damagePerHardHit: 34,
  landingMaxSink: 6.5, // m/s of descent allowed for a safe touchdown
  landingMaxSpeed: 46,

  // Rings
  ringRadius: 15,
  ringGlow: 0xffb020,

  // Camera
  camDistance: 16,
  camHeight: 5.2,
  camLag: 4.5,

  // Scoring
  pointsPerRing: 100,
  landingBonus: 300,
  timeBonusPerSecond: 4,
};

// Metres to the feet and knots the HUD shows.
export const M_TO_FT = 3.28084;
export const MS_TO_KT = 1.94384;
