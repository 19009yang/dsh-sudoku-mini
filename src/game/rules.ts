import type { Digit } from './types.ts';

export const ALL = 0x1ff;
export const bit = (digit: number): number => 1 << (digit - 1);
export const digits = (mask: number): Digit[] => Array.from({ length: 9 }, (_, i) => i + 1).filter(d => mask & bit(d)) as Digit[];
export const units: number[][] = [
  ...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, b) => Array.from({ length: 9 }, (_, i) => Math.floor(b / 3) * 27 + b % 3 * 3 + Math.floor(i / 3) * 9 + i % 3)),
];
export const peers = Array.from({ length: 81 }, (_, i) => [...new Set(units.filter(u => u.includes(i)).flat())].filter(j => j !== i));
export const parseGrid = (grid: string): Digit[] => [...grid].map(Number) as Digit[];
export function candidates(values: readonly number[], index: number): number {
  if (values[index]) return 0;
  return peers[index].reduce((mask, p) => values[p] ? mask & ~bit(values[p]) : mask, ALL);
}
export function conflicts(values: readonly number[]): Set<number> {
  const result = new Set<number>();
  for (const unit of units) {
    for (const index of unit) {
      if (values[index] && unit.some(other => other !== index && values[other] === values[index])) result.add(index);
    }
  }
  return result;
}
export function isComplete(values: readonly number[]): boolean {
  return values.length === 81 && values.every(v => Number.isInteger(v) && v >= 1 && v <= 9) && conflicts(values).size === 0;
}
