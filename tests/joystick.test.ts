import { expect, it } from 'vitest';
import { defaultJoystick, idleJoystick, joystickDown, joystickMove, joystickUp } from '../src/game2048/joystick.ts';

const config = defaultJoystick;
const drag = (dx: number, dy: number, at: number) => joystickMove(joystickDown(0, 0, 0), dx, dy, at, config);

it('ignores a drag that never reaches the minimum speed', () => {
  expect(drag(10, 0, 80).direction).toBeNull(); // 0.125 px/ms
  expect(drag(27, 0, 80).direction).toBeNull(); // 0.3375 px/ms
  expect(drag(28, 0, 80).direction).toBe('right'); // 0.35 px/ms is the bar
  expect(drag(0, -28, 80).direction).toBe('up');
  expect(drag(-28, 0, 80).direction).toBe('left');
  expect(drag(0, 28, 80).direction).toBe('down');
});

it('quantizes to the dominant axis of the pointer velocity', () => {
  expect(drag(30, 20, 80).direction).toBe('right');
  expect(drag(20, 30, 80).direction).toBe('down');
  expect(drag(-30, 20, 80).direction).toBe('left');
  expect(drag(20, -30, 80).direction).toBe('up');
});

it('has no span to measure once the origin sample leaves the window or the drag ends', () => {
  expect(drag(30, 0, 200).direction).toBeNull();
  expect(joystickMove(idleJoystick, 30, 0, 80, config).direction).toBeNull();
  const released = joystickUp(joystickMove(joystickDown(0, 0, 0), 30, 0, 80, config).state);
  expect(released.active).toBe(false); expect(released.knobX).toBe(0); expect(released.knobY).toBe(0);
  expect(joystickMove(released, 60, 0, 100, config).direction).toBeNull();
});

it('clamps the knob while keeping the raw pointer speed', () => {
  const step = joystickMove(joystickDown(0, 0, 0), 100, 0, 10, config);
  expect(Math.hypot(step.state.knobX, step.state.knobY)).toBeCloseTo(config.maxRadius);
  expect(step.state.knobX).toBeCloseTo(config.maxRadius);
  expect(step.direction).toBe('right');
  const diagonal = joystickMove(joystickDown(0, 0, 0), 100, 100, 10, config);
  expect(Math.hypot(diagonal.state.knobX, diagonal.state.knobY)).toBeCloseTo(config.maxRadius);
});

it('rate-limits repeated fires from one uninterrupted fast drag', () => {
  const first = joystickMove(joystickDown(0, 0, 0), 30, 0, 80, config);
  expect(first.direction).toBe('right');
  expect(joystickMove(first.state, 60, 0, 100, config).direction).toBeNull(); // 20 ms later
  const rebuild = joystickMove(first.state, 90, 0, 300, config);
  expect(rebuild.direction).toBeNull(); // the fire cleared the window, so speed restarts from zero
  const second = joystickMove(rebuild.state, 120, 0, 360, config);
  expect(second.direction).toBe('right');
});

it('honours the optional re-arm brake without touching the default sensitive mode', () => {
  const strict = { ...defaultJoystick, rearmSpeed: 0.2 };
  let step = joystickMove(joystickDown(0, 0, 0), 30, 0, 80, strict);
  expect(step.direction).toBe('right'); expect(step.state.armed).toBe(false);
  step = joystickMove(step.state, 31, 0, 140, strict);
  expect(step.state.armed).toBe(true);
  const blocked = joystickMove(step.state, 61, 0, 180, strict);
  expect(blocked.direction).toBeNull();
  expect(joystickMove(blocked.state, 91, 0, 240, strict).direction).toBe('right');
  const loose = joystickMove(joystickDown(0, 0, 0), 30, 0, 80, config);
  expect(joystickMove(loose.state, 60, 0, 100, config).state.armed).toBe(true);
});
