import { candidates, digits, units } from './rules.ts';
import type { Digit, GameState } from './types.ts';
export interface Hint { kind: 'error' | 'logic' | 'reveal'; index: number; digit: Digit; text: string }
export function getHint(state: GameState): Hint | null {
  const error = state.values.findIndex((v, i) => v !== 0 && v !== state.solution[i]);
  if (error >= 0) return { kind: 'error', index: error, digit: 0, text: `第 ${Math.floor(error / 9) + 1} 行第 ${error % 9 + 1} 列的数字需要检查，请先擦除或修改。` };
  for (let i = 0; i < 81; i++) {
    const ds = digits(candidates(state.values, i));
    if (ds.length === 1) return { kind: 'logic', index: i, digit: ds[0], text: `该格所在行、列和宫已排除其他数字，只能填 ${ds[0]}。` };
  }
  for (const [u, unit] of units.entries()) {
    for (let d = 1; d <= 9; d++) {
      const places = unit.filter(i => !state.values[i] && (candidates(state.values, i) & (1 << d - 1)));
      if (places.length === 1) return { kind: 'logic', index: places[0], digit: d as Digit, text: `在该${u < 9 ? '行' : u < 18 ? '列' : '宫'}中，数字 ${d} 只能出现在此格。` };
    }
  }
  const selected = state.selectedCell;
  const index = selected !== null && !state.values[selected] ? selected : state.values.findIndex(v => !v);
  return index < 0 ? null : { kind: 'reveal', index, digit: state.solution[index], text: '暂未找到单候选逻辑提示。可以直接揭示此格答案；这不是逻辑推导。' };
}
