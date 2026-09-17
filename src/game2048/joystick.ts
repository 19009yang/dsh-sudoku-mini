import type { Direction } from './types.ts';

/**
 * The knob is a pure gesture reducer: the widget only feeds pointer samples in and reads a
 * direction out, so the trigger thresholds stay unit-testable without any DOM.
 *
 * The trigger is speed-only, by design. There is no distance gate, so a slow drag never moves
 * tiles; `rearmSpeed` is the only optional brake (set it above 0 to require a slow-down between
 * two fires, leave it at 0 for the most sensitive joystick).
 */
export interface JoystickConfig {
  /** Minimum pointer speed in px/ms before a move fires. */
  fireSpeed: number;
  /** Minimum gap in ms between two fires from the same drag. */
  minInterval: number;
  /** Pointer samples older than this are dropped when measuring speed. */
  sampleWindow: number;
  /** Visual clamp radius of the knob in px. */
  maxRadius: number;
  /** Speed in px/ms the pointer must fall back to before firing again. 0 disables the brake. */
  rearmSpeed: number;
}

export const defaultJoystick: JoystickConfig = { fireSpeed: 0.35, minInterval: 140, sampleWindow: 80, maxRadius: 36, rearmSpeed: 0 };
/** Touch drags accelerate faster than a mouse, so they need a slightly lower bar. */
export const touchJoystick: JoystickConfig = { ...defaultJoystick, fireSpeed: 0.28, minInterval: 160 };

export interface JoystickSample { x: number; y: number; t: number }

export interface JoystickState {
  active: boolean;
  originX: number;
  originY: number;
  knobX: number;
  knobY: number;
  samples: JoystickSample[];
  lastFireAt: number;
  armed: boolean;
}

export const idleJoystick: JoystickState = { active: false, originX: 0, originY: 0, knobX: 0, knobY: 0, samples: [], lastFireAt: -Infinity, armed: true };

export interface JoystickStep { state: JoystickState; direction: Direction | null }

const clampToRadius = (dx: number, dy: number, radius: number): { x: number; y: number } => {
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || distance <= radius) return { x: dx, y: dy };
  return { x: dx / distance * radius, y: dy / distance * radius };
};

function velocity(samples: readonly JoystickSample[]): { vx: number; vy: number } {
  const first = samples[0], last = samples[samples.length - 1];
  const span = last.t - first.t;
  if (samples.length < 2 || span <= 0) return { vx: 0, vy: 0 };
  return { vx: (last.x - first.x) / span, vy: (last.y - first.y) / span };
}

export function joystickDown(x: number, y: number, now: number): JoystickState {
  return { active: true, originX: x, originY: y, knobX: 0, knobY: 0, samples: [{ x, y, t: now }], lastFireAt: -Infinity, armed: true };
}

export function joystickUp(state: JoystickState): JoystickState {
  return { ...state, active: false, knobX: 0, knobY: 0, samples: [], armed: true };
}

export function joystickMove(state: JoystickState, x: number, y: number, now: number, config: JoystickConfig = defaultJoystick): JoystickStep {
  if (!state.active) return { state, direction: null };
  const samples = [...state.samples.filter(sample => now - sample.t <= config.sampleWindow), { x, y, t: now }];
  const { vx, vy } = velocity(samples);
  const speed = Math.hypot(vx, vy);
  // With the brake disabled the knob is always armed, so minInterval alone paces the moves.
  const braking = config.rearmSpeed > 0;
  const armed = !braking || state.armed || speed <= config.rearmSpeed;
  const fired = armed && speed >= config.fireSpeed && now - state.lastFireAt >= config.minInterval;
  const direction: Direction | null = fired
    ? Math.abs(vx) >= Math.abs(vy) ? (vx >= 0 ? 'right' : 'left') : (vy >= 0 ? 'down' : 'up')
    : null;
  const knob = clampToRadius(x - state.originX, y - state.originY, config.maxRadius);
  return {
    direction,
    state: {
      ...state,
      knobX: knob.x,
      knobY: knob.y,
      // Clearing the window after a fire makes the next reading rebuild from the new pointer position.
      samples: fired ? [] : samples,
      lastFireAt: fired ? now : state.lastFireAt,
      armed: fired && braking ? false : armed,
    },
  };
}
