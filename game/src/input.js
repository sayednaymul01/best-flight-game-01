// Coral Run — keyboard and mouse input, read once per frame into a plain
// state object the flight model consumes. Keys are the primary control;
// the mouse steers gently while its button is held.
export function createInput(canvas) {
  const keys = new Set();
  const state = {
    pitch: 0, // -1 (nose down) .. +1 (nose up)
    roll: 0, // -1 (left) .. +1 (right)
    throttleUp: false,
    throttleDown: false,
    mouseSteer: 0, // -1 .. +1 from pointer position while held
    mousePitch: 0,
    mouseHeld: false,
    pressed: new Set(), // edge-triggered keys, consumed by the game loop
  };

  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    keys.add(e.code);
    state.pressed.add(e.code);
  };
  const up = (e) => keys.delete(e.code);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    state.mouseHeld = true;
    updateMouse(e);
  });
  window.addEventListener('mouseup', () => {
    state.mouseHeld = false;
    state.mouseSteer = 0;
    state.mousePitch = 0;
  });
  window.addEventListener('mousemove', (e) => {
    if (state.mouseHeld) updateMouse(e);
  });

  function updateMouse(e) {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    state.mouseSteer = Math.max(-1, Math.min(1, nx));
    state.mousePitch = Math.max(-1, Math.min(1, -ny));
  }

  // Poll the held keys into the per-frame control state.
  state.poll = () => {
    const pitchKeys = (keys.has('ArrowUp') || keys.has('KeyI') ? 1 : 0)
      + (keys.has('ArrowDown') || keys.has('KeyK') ? -1 : 0);
    const rollKeys = (keys.has('ArrowRight') || keys.has('KeyL') ? 1 : 0)
      + (keys.has('ArrowLeft') || keys.has('KeyJ') ? -1 : 0);
    state.pitch = Math.max(-1, Math.min(1, pitchKeys + state.mousePitch * 0.8));
    state.roll = Math.max(-1, Math.min(1, rollKeys + state.mouseSteer * 0.8));
    state.throttleUp = keys.has('KeyW') || keys.has('ShiftLeft') || keys.has('ShiftRight');
    state.throttleDown = keys.has('KeyS') || keys.has('ControlLeft') || keys.has('ControlRight');
  };

  state.wasPressed = (code) => {
    if (state.pressed.has(code)) {
      state.pressed.delete(code);
      return true;
    }
    return false;
  };
  state.clearPressed = () => state.pressed.clear();

  return state;
}
