export function createClock(onElapsed: (elapsed: number) => void): { setRunning(running: boolean): void; settle(): void; destroy(): void } {
  let timer: ReturnType<typeof setInterval> | null = null, previous = 0, destroyed = false;
  const settle = () => { if (timer !== null) { const now = performance.now(); onElapsed(Math.max(0, now - previous)); previous = now; } };
  return {
    settle,
    setRunning(running) {
      if (destroyed) return;
      if (running && timer === null) { previous = performance.now(); timer = setInterval(settle, 1000); }
      else if (!running && timer !== null) { settle(); clearInterval(timer); timer = null; }
    },
    destroy() { if (destroyed) return; settle(); if (timer !== null) clearInterval(timer); timer = null; destroyed = true; },
  };
}
export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000), mins = Math.floor(seconds / 60);
  return `${String(mins).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
