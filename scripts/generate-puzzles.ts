import { writeFileSync } from 'node:fs';
import { puzzles, random, shuffle, transform } from '../src/game/puzzles.ts';
import { difficulties, type Puzzle } from '../src/game/types.ts';
import { countSolutions, ratePuzzle, RATING_VERSION } from './solver.ts';

const resume = process.argv.includes('--resume');
const rng = random(resume ? 20260916 : 20260915), bank: Puzzle[] = resume ? [...puzzles] : [], counts = { easy: 0, medium: 0, hard: 0, expert: 0 };
for (const p of bank) counts[p.difficulty]++;
const base = '123456789456789123789123456234567891567891234891234567345678912678912345912345678';
const seen = new Set(bank.map(p => p.givens)), deadline = Date.now() + 600_000;
for (let attempt = 0; attempt < 100_000 && Date.now() < deadline; attempt++) {
  if (difficulties.every(d => counts[d] >= 20)) break;
  const solution = transform(base, Math.floor(rng() * 0xffffffff)), values = [...solution];
  // Different clue densities improve coverage; grading remains based on techniques.
  const target = 23 + Math.floor(rng() * 15);
  for (const i of shuffle(Array.from({ length: 81 }, (_, i) => i), rng)) {
    const previous = values[i]; values[i] = 0;
    if (countSolutions(values) !== 1) values[i] = previous;
    if (values.filter(Boolean).length <= target) break;
  }
  const givens = values.join(''), rating = ratePuzzle(values);
  if (!rating || counts[rating.difficulty] >= 20 || seen.has(givens)) continue;
  seen.add(givens); const number = ++counts[rating.difficulty];
  bank.push({ id: `${rating.difficulty}-${String(number).padStart(2, '0')}`, difficulty: rating.difficulty, givens, solution: solution.join(''), ratingVersion: RATING_VERSION, ratingScore: rating.score, hardestTechnique: rating.hardestTechnique });
  console.log(attempt, counts);
}
if (difficulties.some(d => counts[d] < 20)) throw new Error(`题库数量不足：${JSON.stringify(counts)}`);
writeFileSync(new URL('../src/data/puzzles.json', import.meta.url), JSON.stringify(bank, null, 2) + '\n');
console.log(`已生成 ${bank.length} 道唯一解题目。`);
