import { BANK_VERSION, TRANSFORM_VERSION, createGame, puzzles } from '../game/puzzles.ts';
import { isComplete } from '../game/rules.ts';
import { difficulties, type CellChange, type GameState, type HistoryEntry, type Settings } from '../game/types.ts';

export const GAME_KEY = 'dsh-sudoku-mini:v1:game';
export const SETTINGS_KEY = 'dsh-sudoku-mini:v1:settings';
export const defaultSettings: Settings = { difficulty: 'expert', answerCheck: false, autoClean: true, theme: 'system', position: null };
export interface Snapshot {
  schema: 1; bankVersion: number; transformVersion: number; tabId: string; revision: number;
  puzzleId: string; seed: number; values: number[]; notes: number[]; elapsedMs: number;
  hintCount: number; selectedCell: number | null; noteMode: boolean; history: HistoryEntry[];
}
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
function change(v: unknown): v is CellChange {
  return record(v) && integer(v.index, 0, 80) && integer(v.value, 0, 9) && integer(v.notes, 0, 511) && (!v.value || v.notes === 0);
}
export function restoreSnapshot(raw: unknown): GameState {
  if (!record(raw) || raw.schema !== 1 || raw.bankVersion !== BANK_VERSION || raw.transformVersion !== TRANSFORM_VERSION) throw new Error('存档版本不兼容');
  const puzzle = puzzles.find(p => p.id === raw.puzzleId);
  if (!puzzle || !integer(raw.seed, 0, 0xffffffff)) throw new Error('题目不存在');
  const state = createGame(puzzle, raw.seed);
  if (!Array.isArray(raw.values) || raw.values.length !== 81 || !raw.values.every(v => integer(v, 0, 9))) throw new Error('数字格式无效');
  if (!Array.isArray(raw.notes) || raw.notes.length !== 81 || !raw.notes.every(v => integer(v, 0, 511))) throw new Error('笔记格式无效');
  if (!raw.values.every((v, i) => (!state.givens[i] || v === state.givens[i]) && (!v || raw.notes instanceof Array && raw.notes[i] === 0))) throw new Error('固定格或笔记无效');
  if (!integer(raw.elapsedMs, 0, Number.MAX_SAFE_INTEGER) || !integer(raw.hintCount, 0, Number.MAX_SAFE_INTEGER) || !(raw.selectedCell === null || integer(raw.selectedCell, 0, 80)) || typeof raw.noteMode !== 'boolean') throw new Error('游戏状态无效');
  if (!Array.isArray(raw.history) || raw.history.length > 200) throw new Error('历史格式无效');
  const history: HistoryEntry[] = [];
  for (const h of raw.history) {
    if (!record(h) || !Array.isArray(h.before) || !Array.isArray(h.after) || !h.before.length || h.before.length !== h.after.length || h.before.length > 81 || !h.before.every(change) || !h.after.every(change)) throw new Error('撤销动作无效');
    if (new Set(h.before.map(c => c.index)).size !== h.before.length || !h.before.every((c, i) => c.index === (h.after as CellChange[])[i].index && !state.givens[c.index])) throw new Error('撤销修改固定格');
    history.push({ before: h.before, after: h.after });
  }
  // Validate the chain against the current board, rather than trusting serialized undo.
  const checkValues = [...raw.values], checkNotes = [...raw.notes];
  for (const h of [...history].reverse()) {
    for (const c of h.after) if (checkValues[c.index] !== c.value || checkNotes[c.index] !== c.notes) throw new Error('撤销历史失配');
    for (const c of h.before) { checkValues[c.index] = c.value; checkNotes[c.index] = c.notes; }
  }
  return { ...state, values: raw.values as GameState['values'], notes: raw.notes, elapsedMs: raw.elapsedMs, hintCount: raw.hintCount, selectedCell: raw.selectedCell, noteMode: raw.noteMode, history, status: isComplete(raw.values) ? 'won' : 'playing' };
}
export function readSettings(storage?: Storage): Settings {
  try {
    const raw: unknown = JSON.parse((storage ?? localStorage).getItem(SETTINGS_KEY) ?? 'null');
    if (!record(raw)) return { ...defaultSettings };
    const position = record(raw.position) && typeof raw.position.x === 'number' && typeof raw.position.y === 'number' && Number.isFinite(raw.position.x) && Number.isFinite(raw.position.y) ? { x: Math.max(0, Math.min(1, raw.position.x)), y: Math.max(0, Math.min(1, raw.position.y)) } : null;
    return { difficulty: difficulties.includes(raw.difficulty as Settings['difficulty']) ? raw.difficulty as Settings['difficulty'] : 'expert', answerCheck: raw.answerCheck === true, autoClean: raw.autoClean !== false, theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'system', position };
  } catch { return { ...defaultSettings }; }
}
export function readGame(storage?: Storage): { game: GameState | null; error: boolean } {
  try {
    const text = (storage ?? localStorage).getItem(GAME_KEY);
    if (text === null) return { game: null, error: false };
    if (text.length > 65_536) throw new Error('存档过大');
    return { game: restoreSnapshot(JSON.parse(text)), error: false };
  } catch { return { game: null, error: true }; }
}
export function saveGame(game: GameState | null, settings: Settings, tabId: string, revision: number, storage?: Storage): boolean {
  try {
    const target = storage ?? localStorage;
    target.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (game) {
      const snapshot: Snapshot = { schema: 1, bankVersion: BANK_VERSION, transformVersion: TRANSFORM_VERSION, tabId, revision, puzzleId: game.puzzleId, seed: game.transformSeed, values: game.values, notes: game.notes, elapsedMs: Math.floor(game.elapsedMs), hintCount: game.hintCount, selectedCell: game.selectedCell, noteMode: game.noteMode, history: game.history };
      let text = JSON.stringify(snapshot);
      while (text.length > 65_536 && snapshot.history.length) { snapshot.history = snapshot.history.slice(1); text = JSON.stringify(snapshot); }
      if (text.length > 65_536) return false;
      target.setItem(GAME_KEY, text);
    }
    return true;
  } catch { return false; }
}
