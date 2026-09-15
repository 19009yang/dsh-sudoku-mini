import { ALL, bit, candidates, digits, isComplete, peers, units } from '../src/game/rules.ts';
import type { Difficulty } from '../src/game/types.ts';

export const RATING_VERSION = 'logic-v1';
export function countSolutions(input: readonly number[], limit = 2): number {
  if (input.length !== 81 || input.some(v => !Number.isInteger(v) || v < 0 || v > 9)) return 0;
  const values = [...input], rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0); let count = 0, visits = 0;
  const boxOf = (i: number) => Math.floor(i / 27) * 3 + Math.floor(i % 9 / 3);
  for (let i = 0; i < 81; i++) if (values[i]) {
    const mask = bit(values[i]), r = Math.floor(i / 9), c = i % 9, b = boxOf(i);
    if ((rows[r] | cols[c] | boxes[b]) & mask) return 0;
    rows[r] |= mask; cols[c] |= mask; boxes[b] |= mask;
  }
  function search(): void {
    if (count >= limit) return;
    if (++visits > 1_000_000) throw new Error('求解超过节点上限');
    let index = -1, ds: number[] = [];
    for (let i = 0; i < 81; i++) if (!values[i]) {
      const options = digits(ALL & ~(rows[Math.floor(i / 9)] | cols[i % 9] | boxes[boxOf(i)]));
      if (!options.length) return;
      if (index < 0 || options.length < ds.length) { index = i; ds = options; }
      if (ds.length === 1) break;
    }
    if (index < 0) { if (isComplete(values)) count++; return; }
    const r = Math.floor(index / 9), c = index % 9, b = boxOf(index);
    for (const d of ds) {
      const mask = bit(d); values[index] = d; rows[r] |= mask; cols[c] |= mask; boxes[b] |= mask;
      search(); rows[r] &= ~mask; cols[c] &= ~mask; boxes[b] &= ~mask;
      if (count >= limit) break;
    }
    values[index] = 0;
  }
  search(); return count;
}
interface Step { technique: string; level: number; cells: number[] }
export interface Rating { difficulty: Difficulty; score: number; hardestTechnique: string; steps: Step[] }
export function ratePuzzle(input: readonly number[]): Rating | null {
  const values = [...input], masks = values.map((_, i) => candidates(values, i));
  const steps: Step[] = []; let max = 0, hardest = 'single';
  const record = (technique: string, level: number, cells: number[]) => { steps.push({ technique, level, cells }); if (level > max) { max = level; hardest = technique; } };
  const place = (i: number, d: number, technique: string) => { values[i] = d; masks[i] = 0; for (const p of peers[i]) masks[p] &= ~bit(d); record(technique, 0, [i]); };
  const remove = (cells: number[], mask: number, technique: string, level: number): boolean => {
    const changed = cells.filter(i => !values[i] && (masks[i] & mask));
    if (!changed.length) return false;
    for (const i of changed) masks[i] &= ~mask;
    record(technique, level, changed); return true;
  };
  for (let iterations = 0; iterations < 1000; iterations++) {
    if (isComplete(values)) return { difficulty: (['easy', 'medium', 'hard', 'expert'] as Difficulty[])[max], score: steps.reduce((n, s) => n + [1, 5, 12, 30][s.level], 0), hardestTechnique: hardest, steps };
    if (values.some((v, i) => !v && !masks[i])) return null;
    let progress = false;
    for (let i = 0; i < 81; i++) if (!values[i] && digits(masks[i]).length === 1) { place(i, digits(masks[i])[0], 'single'); progress = true; break; }
    if (progress) continue;
    for (const unit of units) {
      for (let d = 1; d <= 9; d++) {
        const places = unit.filter(i => !values[i] && (masks[i] & bit(d)));
        if (places.length === 1) { place(places[0], d, 'hidden-single'); progress = true; break; }
      }
      if (progress) break;
    }
    if (progress) continue;
    // Intersection removal covers both pointing (box -> line) and claiming (line -> box).
    for (const unit of units) {
      for (let d = 1; d <= 9; d++) {
        const places = unit.filter(i => !values[i] && (masks[i] & bit(d)));
        if (places.length < 2) continue;
        for (const other of units) if (other !== unit && places.every(i => other.includes(i))) {
          if (remove(other.filter(i => !unit.includes(i)), bit(d), 'locked-candidate', 1)) { progress = true; break; }
        }
        if (progress) break;
      }
      if (progress) break;
    }
    if (progress) continue;
    for (const unit of units) {
      const empty = unit.filter(i => !values[i]);
      for (let a = 0; a < empty.length; a++) for (let b = a + 1; b < empty.length; b++) {
        const x = empty[a], y = empty[b], mask = masks[x] | masks[y];
        if (digits(mask).length === 2 && remove(empty.filter(i => i !== x && i !== y), mask, 'naked-pair', 2)) { progress = true; break; }
      }
      if (progress) break;
      for (let a = 1; a <= 9; a++) {
        for (let b = a + 1; b <= 9; b++) {
          const ma = bit(a), mb = bit(b), pa = empty.filter(i => masks[i] & ma), pb = empty.filter(i => masks[i] & mb);
          if (pa.length === 2 && pb.length === 2 && pa.every(i => pb.includes(i)) && remove(pa, ALL & ~(ma | mb), 'hidden-pair', 2)) { progress = true; break; }
        }
        if (progress) break;
      }
      if (progress) break;
    }
    if (progress) continue;
    for (const offset of [0, 9]) {
      for (let d = 1; d <= 9; d++) {
        const lines = units.slice(offset, offset + 9);
        for (let a = 0; a < 9; a++) {
          const pa = lines[a].filter(i => !values[i] && (masks[i] & bit(d)));
          if (pa.length !== 2) continue;
          const cross = (i: number) => offset === 0 ? i % 9 : Math.floor(i / 9);
          for (let b = a + 1; b < 9; b++) {
            const pb = lines[b].filter(i => !values[i] && (masks[i] & bit(d)));
            if (pb.length !== 2 || !pa.every(i => pb.some(j => cross(i) === cross(j)))) continue;
            const targets = Array.from({ length: 81 }, (_, i) => i).filter(i => !lines[a].includes(i) && !lines[b].includes(i) && pa.some(j => cross(i) === cross(j)));
            if (remove(targets, bit(d), 'x-wing', 3)) { progress = true; break; }
          }
          if (progress) break;
        }
        if (progress) break;
      }
      if (progress) break;
    }
    if (!progress) return null;
  }
  return null;
}
