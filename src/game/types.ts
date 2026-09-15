export type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];
export const difficultyLabels: Record<Difficulty, string> = { easy: '简单', medium: '中等', hard: '困难', expert: '专家' };
export interface Puzzle {
  id: string; difficulty: Difficulty; givens: string; solution: string;
  ratingVersion: string; ratingScore: number; hardestTechnique: string;
}
export interface CellChange { index: number; value: Digit; notes: number }
export interface HistoryEntry { before: CellChange[]; after: CellChange[] }
export interface GameState {
  puzzleId: string; transformSeed: number; givens: Digit[]; solution: Digit[];
  values: Digit[]; notes: number[]; selectedCell: number | null; noteMode: boolean;
  status: 'playing' | 'won'; elapsedMs: number; hintCount: number; history: HistoryEntry[];
}
export interface Settings {
  difficulty: Difficulty; answerCheck: boolean; autoClean: boolean;
  theme: 'system' | 'light' | 'dark'; position: { x: number; y: number } | null;
}
export type GameAction =
  | { type: 'select'; index: number }
  | { type: 'noteMode' }
  | { type: 'enter'; digit: Digit }
  | { type: 'erase' }
  | { type: 'undo' }
  | { type: 'hint'; index: number; digit: Digit };
