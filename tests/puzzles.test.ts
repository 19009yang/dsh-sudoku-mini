import { expect, it } from 'vitest';
import { createGame, puzzles, transform } from '../src/game/puzzles.ts';
import { isComplete, parseGrid } from '../src/game/rules.ts';
import { difficulties } from '../src/game/types.ts';
import { countSolutions, ratePuzzle } from '../scripts/solver.ts';

it('validates unique solutions and reproducible logic ratings for every puzzle', () => {
  expect(puzzles).toHaveLength(80); expect(new Set(puzzles.map(p => p.givens)).size).toBe(80);
  for (const d of difficulties) expect(puzzles.filter(p => p.difficulty === d)).toHaveLength(20);
  for (const p of puzzles) {
    const values = parseGrid(p.givens); expect(countSolutions(values), p.id).toBe(1);
    const rating = ratePuzzle(values); expect(rating?.difficulty, p.id).toBe(p.difficulty); expect(rating?.score).toBe(p.ratingScore);
    expect(rating?.hardestTechnique).toBe(p.hardestTechnique);
    if (p.difficulty === 'expert') expect(rating?.steps.some(s => s.technique === 'x-wing')).toBe(true);
  }
}, 30_000);
it('seeded transformations preserve rules, givens and uniqueness', () => {
  for (const p of puzzles) for (const seed of [0, 1, 42, 0xffffffff]) {
    const game = createGame(p, seed); expect(isComplete(game.solution)).toBe(true);
    expect(game.givens.every((v, i) => !v || v === game.solution[i])).toBe(true);
    expect(transform(p.givens, seed)).toEqual(game.givens);
    expect(countSolutions(game.givens), `${p.id}:${seed}`).toBe(1);
  }
}, 30_000);
it('counts invalid, unsatisfiable and ambiguous grids independently of metadata', () => {
  expect(countSolutions(Array(81).fill(0))).toBe(2);
  expect(countSolutions(Array(81).fill(1))).toBe(0);
  const bad = parseGrid(puzzles[0].solution); bad[0] = bad[1]; expect(countSolutions(bad)).toBe(0);
});
