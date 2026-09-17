/** Deterministic PRNG shared by the sudoku board transform and the 2048 tile spawner. */
export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state += 0x6d2b79f5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [output[i], output[j]] = [output[j], output[i]]; }
  return output;
}

export const newSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0];

/** Advances a stored seed so consecutive draws stay reproducible without keeping a live closure. */
export const nextSeed = (seed: number): number => (seed + 0x6d2b79f5) >>> 0;
