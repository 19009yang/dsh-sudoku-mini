import bank from '../data/puzzles.json' with { type: 'json' };
import { newSeed, random, shuffle } from '../shared/random.ts';
import { parseGrid } from './rules.ts';
import type { Difficulty, Digit, GameState, Puzzle } from './types.ts';

export const puzzles: Puzzle[] = bank as Puzzle[];
export const BANK_VERSION = 1;
export const TRANSFORM_VERSION = 1;
export { newSeed, random, shuffle };
export function transform(grid: string, seed: number): Digit[] {
  const rng = random(seed);
  const numbers = [0, ...shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)];
  const order = () => shuffle([0, 1, 2], rng).flatMap(b => shuffle([0, 1, 2], rng).map(i => b * 3 + i));
  const rows = order(), cols = order(), transpose = rng() > .5, values = parseGrid(grid);
  return Array.from({ length: 81 }, (_, i) => {
    const r = rows[Math.floor(i / 9)], c = cols[i % 9];
    return numbers[values[transpose ? c * 9 + r : r * 9 + c]] as Digit;
  });
}
export function createGame(puzzle: Puzzle, seed: number): GameState {
  const givens = transform(puzzle.givens, seed);
  return { puzzleId: puzzle.id, transformSeed: seed >>> 0, givens, solution: transform(puzzle.solution, seed), values: [...givens], notes: Array(81).fill(0), selectedCell: givens.findIndex(v => !v), noteMode: false, status: 'playing', elapsedMs: 0, hintCount: 0, history: [] };
}
export function pickPuzzle(difficulty: Difficulty, recent: readonly string[] = []): Puzzle {
  const options = puzzles.filter(p => p.difficulty === difficulty);
  const available = options.filter(p => !recent.includes(p.id));
  const pool = available.length ? available : options;
  if (!pool.length) throw new Error(`题库缺少 ${difficulty}`);
  return pool[Math.floor(Math.random() * pool.length)];
}
