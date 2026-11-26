// Coral Run — the cockpit HUD: altitude, speed and heading on the dials,
// throttle and fuel bars, the mission objective, and a top-down minimap
// with the runway, the rings and the plane's arrow.
import { CONFIG, M_TO_FT, MS_TO_KT } from './config.js';
import { clamp } from './random.js';

function compass16(heading) {
  // heading 0 = east; compass shows degrees clockwise from north.
  const deg = ((90 - (heading * 180) / Math.PI) % 360 + 360) % 360;
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return `${String(Math.round(deg)).padStart(3, '0')}° ${points[Math.round(deg / 22.5) % 16]}`;
}

export function createHUD() {
  const root = document.getElementById('hud');
  const map = document.getElementById('minimap');
  const mapCtx = map.getContext('2d');

  const els = {
    alt: document.getElementById('hud-alt'),
    speed: document.getElementById('hud-speed'),
    heading: document.getElementById('hud-heading'),
    throttle: document.getElementById('hud-throttle'),
    throttleFill: document.getElementById('throttle-fill'),
    fuelFill: document.getElementById('fuel-fill'),
    fuelLabel: document.getElementById('hud-fuel'),
    score: document.getElementById('hud-score'),
    objective: document.getElementById('hud-objective'),
    timer: document.getElementById('hud-timer'),
    message: document.getElementById('hud-message'),
    banner: document.getElementById('hud-banner'),
  };

  let messageTimer = 0;

  function showMessage(text, seconds = 2.5) {
    els.message.textContent = text;
    els.message.style.opacity = '1';
    messageTimer = seconds;
  }

  function showBanner(text) {
    els.banner.textContent = text;
    els.banner.style.opacity = '1';
    setTimeout(() => { els.banner.style.opacity = '0'; }, 1800);
  }

  function update(s, mission, ringTarget, timeLeft, score) {
    const altFt = Math.max(0, Math.round((s.pos.y - 6) * M_TO_FT));
    els.alt.textContent = `${altFt.toLocaleString('en-US')} ft`;
    els.speed.textContent = `${Math.round(s.speed * MS_TO_KT)} kt`;
    els.heading.textContent = compass16(s.heading);
    els.throttle.textContent = `${Math.round(s.throttle * 100)}%`;
    els.throttleFill.style.width = `${Math.round(s.throttle * 100)}%`;
    const fuelPct = clamp((s.fuel / CONFIG.fuelMax) * 100, 0, 100);
    els.fuelFill.style.width = `${fuelPct}%`;
    els.fuelFill.classList.toggle('low', fuelPct < 25);
    els.fuelLabel.textContent = `FUEL ${Math.round(fuelPct)}%`;
    els.score.textContent = `SCORE ${score.toLocaleString('en-US')}`;
    const mins = Math.floor(Math.max(0, timeLeft) / 60);
    const secs = Math.floor(Math.max(0, timeLeft) % 60);
    els.timer.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    els.timer.classList.toggle('low', timeLeft < 30);
    if (ringTarget) {
      const d = Math.round(ringTarget.position.distanceTo(s.pos));
      els.objective.textContent = `RING ${ringTarget.userData.index + 1} — ${d} m ahead`;
    } else if (mission.needsLanding && !s.landed) {
      els.objective.textContent = 'ALL RINGS DONE — LAND ON THE RUNWAY';
    } else {
      els.objective.textContent = 'MISSION COMPLETE';
    }
  }

  // Top-down minimap: island disc, runway strip, rings and the plane arrow.
  function drawMinimap(s, rings) {
    const W = map.width;
    const H = map.height;
    const cx = W / 2;
    const cy = H / 2;
    const scale = W / 2400;
    const toMap = (x, z) => [cx + x * scale, cy + z * scale];
    mapCtx.clearRect(0, 0, W, H);
    mapCtx.fillStyle = 'rgba(10, 26, 40, 0.55)';
    mapCtx.beginPath();
    mapCtx.arc(cx, cy, W / 2 - 2, 0, Math.PI * 2);
    mapCtx.fill();
    // Island
    mapCtx.fillStyle = '#3f7d3a';
    mapCtx.beginPath();
    mapCtx.arc(cx, cy, CONFIG.islandRadius * scale, 0, Math.PI * 2);
    mapCtx.fill();
    // Runway
    const rw = CONFIG.runway;
    const [rx, ry] = toMap(rw.x, rw.z);
    mapCtx.fillStyle = '#e8e8e8';
    mapCtx.fillRect(rx - (rw.length / 2) * scale, ry - 2, rw.length * scale, 4);
    // Rings: amber when pending, green when flown.
    for (const r of rings) {
      const [x, y] = toMap(r.position.x, r.position.z);
      mapCtx.fillStyle = r.userData.passed ? '#37d67a' : '#ffb020';
      mapCtx.beginPath();
      mapCtx.arc(x, y, r.userData.passed ? 3 : 4.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Plane arrow, rotated by heading.
    const [px, py] = toMap(s.pos.x, s.pos.z);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(-s.heading);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(8, 0);
    mapCtx.lineTo(-6, -5);
    mapCtx.lineTo(-3, 0);
    mapCtx.lineTo(-6, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  function tick(dt) {
    if (messageTimer > 0) {
      messageTimer -= dt;
      if (messageTimer <= 0) els.message.style.opacity = '0';
    }
  }

  return { update, drawMinimap, showMessage, showBanner, tick, root };
}
