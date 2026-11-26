// Coral Run — all sound is synthesised with WebAudio: an engine hum that
// follows the throttle, wind that rises with speed, a chime for each ring
// and a thud for a crash. No audio files, no network.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSrc = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (err) {
      return false;
    }
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 110;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();

    // Wind: looped filtered noise, gain follows airspeed.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    windSrc = ctx.createBufferSource();
    windSrc.buffer = buf;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    windSrc.start();
    return true;
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  }

  return {
    resume,
    toggleMute() {
      muted = !muted;
      if (ctx) ctx.destination.gain ? null : null;
      if (engineGain) engineGain.gain.value = muted ? 0 : engineGain.gain.value;
      return muted;
    },
    get muted() {
      return muted;
    },
    // Called every frame while flying: engine pitch and wind follow speed.
    update(throttle, speedNorm, flying) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(48 + throttle * 62, t, 0.1);
      engineOsc2.frequency.setTargetAtTime(96 + throttle * 124, t, 0.1);
      engineGain.gain.setTargetAtTime(flying ? 0.045 + throttle * 0.05 : 0.02, t, 0.15);
      windGain.gain.setTargetAtTime(speedNorm * speedNorm * 0.09, t, 0.2);
    },
    ring() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      [880, 1174, 1568].forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t + i * 0.07);
        g.gain.linearRampToValueAtTime(0.16, t + i * 0.07 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.5);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(t + i * 0.07);
        o.stop(t + i * 0.07 + 0.55);
      });
    },
    crash() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const len = ctx.sampleRate * 0.5;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      src.connect(g);
      g.connect(ctx.destination);
      src.start(t);
    },
    land() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      [523, 659, 784].forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t + i * 0.09);
        g.gain.linearRampToValueAtTime(0.14, t + i * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.4);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(t + i * 0.09);
        o.stop(t + i * 0.09 + 0.45);
      });
    },
  };
}
