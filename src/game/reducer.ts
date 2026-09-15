import { bit, isComplete, peers } from './rules.ts';
import type { CellChange, GameAction, GameState } from './types.ts';

export function reduceGame(state: GameState, action: GameAction, autoClean = true): GameState {
  if (action.type === 'select') return action.index >= 0 && action.index < 81 ? { ...state, selectedCell: action.index } : state;
  if (action.type === 'noteMode') return { ...state, noteMode: !state.noteMode };
  if (action.type === 'undo') {
    const last = state.history.at(-1);
    if (!last) return state;
    const values = [...state.values], notes = [...state.notes];
    for (const change of last.before) { values[change.index] = change.value; notes[change.index] = change.notes; }
    return { ...state, values, notes, status: isComplete(values) ? 'won' : 'playing', history: state.history.slice(0, -1) };
  }
  if (state.status === 'won') return state;
  const index = action.type === 'hint' ? action.index : state.selectedCell;
  if (index === null || index < 0 || index >= 81 || state.givens[index]) return state;
  const values = [...state.values], notes = [...state.notes];
  if (action.type === 'erase') { values[index] = 0; notes[index] = 0; }
  else if (action.type === 'enter' && state.noteMode && action.digit) { values[index] = 0; notes[index] ^= bit(action.digit); }
  else {
    const digit = action.digit;
    values[index] = digit; notes[index] = 0;
    if (autoClean && digit) for (const p of peers[index]) notes[p] &= ~bit(digit);
  }
  const before: CellChange[] = [], after: CellChange[] = [];
  for (let i = 0; i < 81; i++) {
    if (values[i] !== state.values[i] || notes[i] !== state.notes[i]) {
      before.push({ index: i, value: state.values[i], notes: state.notes[i] });
      after.push({ index: i, value: values[i], notes: notes[i] });
    }
  }
  if (!before.length) return state;
  return { ...state, values, notes, selectedCell: index, hintCount: state.hintCount + (action.type === 'hint' ? 1 : 0), status: isComplete(values) ? 'won' : 'playing', history: [...state.history, { before, after }].slice(-200) };
}
