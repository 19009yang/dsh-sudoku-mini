import { puzzles } from '../src/game/puzzles.ts';
import { isComplete, parseGrid } from '../src/game/rules.ts';
import { difficulties } from '../src/game/types.ts';
import { countSolutions, ratePuzzle, RATING_VERSION } from './solver.ts';
import assert from 'node:assert/strict';

assert.equal(new Set(puzzles.map(p => p.id)).size, puzzles.length);
assert.equal(new Set(puzzles.map(p => p.givens)).size, puzzles.length);
for (const p of puzzles) {
  assert.match(p.givens, /^[0-9]{81}$/); assert.match(p.solution, /^[1-9]{81}$/);
  const values = parseGrid(p.givens), solution = parseGrid(p.solution);
  assert.ok(isComplete(solution), p.id);
  assert.ok(values.every((v, i) => !v || v === solution[i]), p.id);
  assert.equal(countSolutions(values), 1, p.id);
  const rating = ratePuzzle(values);
  assert.ok(rating, p.id); assert.equal(rating.difficulty, p.difficulty, p.id);
  assert.equal(p.ratingVersion, RATING_VERSION); assert.equal(p.hardestTechnique, rating.hardestTechnique);
  assert.equal(p.ratingScore, rating.score);
}
for (const d of difficulties) assert.ok(puzzles.filter(p => p.difficulty === d).length >= 20, d);
console.log(`题库校验通过：${puzzles.length} 道题目，四档各至少 20 道。`);
