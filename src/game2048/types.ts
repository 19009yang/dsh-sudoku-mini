export type Direction = 'up' | 'down' | 'left' | 'right';

export const SIZE = 4;
export const CELLS = SIZE * SIZE;

export interface Tile { id: number; value: number; row: number; col: number }

export interface Game2048 {
  tiles: Tile[];
  score: number;
  seed: number;
  nextId: number;
  moves: number;
  /** Set once the win card has been shown, so restoring a saved game does not repeat it. */
  won: boolean;
  status: 'playing' | 'over';
}
