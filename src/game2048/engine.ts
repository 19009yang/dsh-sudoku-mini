import { nextSeed, random } from '../shared/random.ts';
import { CELLS, SIZE, type Direction, type Game2048, type Tile } from './types.ts';

export interface MoveOutcome {
  game: Game2048;
  moved: boolean;
  gained: number;
  merged: number[];
  spawned: number | null;
}

const cellOf = (tile: Tile): number => tile.row * SIZE + tile.col;
export const rowOf = (cell: number): number => Math.floor(cell / SIZE);
export const colOf = (cell: number): number => cell % SIZE;

/** Cell indexes of each of the SIZE lines, ordered from the edge the tiles travel toward. */
export function linesFor(direction: Direction): number[][] {
  const lines: number[][] = [];
  for (let i = 0; i < SIZE; i++) {
    const row = Array.from({ length: SIZE }, (_, j) => i * SIZE + j);
    const column = Array.from({ length: SIZE }, (_, j) => j * SIZE + i);
    if (direction === 'left') lines.push(row);
    else if (direction === 'right') lines.push([...row].reverse());
    else if (direction === 'up') lines.push(column);
    else lines.push([...column].reverse());
  }
  return lines;
}

export function gridOf(tiles: readonly Tile[]): (Tile | null)[] {
  const grid: (Tile | null)[] = Array(CELLS).fill(null);
  for (const tile of tiles) grid[cellOf(tile)] = tile;
  return grid;
}

export function maxTile(tiles: readonly Tile[]): number {
  return tiles.reduce((max, tile) => Math.max(max, tile.value), 0);
}

export function hasMoves(tiles: readonly Tile[]): boolean {
  if (tiles.length < CELLS) return true;
  const grid = gridOf(tiles);
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const value = grid[row * SIZE + col]!.value;
      if (col + 1 < SIZE && grid[row * SIZE + col + 1]!.value === value) return true;
      if (row + 1 < SIZE && grid[(row + 1) * SIZE + col]!.value === value) return true;
    }
  }
  return false;
}

/** Adds one random tile (90% a 2, 10% a 4) and resolves the game-over status. */
export function spawnTile(game: Game2048): { game: Game2048; spawned: number | null } {
  const occupied = new Set(game.tiles.map(cellOf));
  const empty: number[] = [];
  for (let cell = 0; cell < CELLS; cell++) if (!occupied.has(cell)) empty.push(cell);
  if (!empty.length) return { game: { ...game, status: hasMoves(game.tiles) ? 'playing' : 'over' }, spawned: null };
  const rng = random(game.seed);
  const cell = empty[Math.floor(rng() * empty.length)];
  const tile: Tile = { id: game.nextId, value: rng() < 0.9 ? 2 : 4, row: rowOf(cell), col: colOf(cell) };
  const tiles = [...game.tiles, tile];
  return { game: { ...game, tiles, nextId: game.nextId + 1, seed: nextSeed(game.seed), status: hasMoves(tiles) ? 'playing' : 'over' }, spawned: tile.id };
}

export function createGame(seed: number): Game2048 {
  const base: Game2048 = { tiles: [], score: 0, seed: seed >>> 0, nextId: 1, moves: 0, won: false, status: 'playing' };
  return spawnTile(spawnTile(base).game).game;
}

export function move(game: Game2048, direction: Direction): MoveOutcome {
  if (game.status !== 'playing') return { game, moved: false, gained: 0, merged: [], spawned: null };
  const grid = gridOf(game.tiles);
  const before = Array.from({ length: CELLS }, (_, cell) => grid[cell]?.value ?? 0);
  const tiles: Tile[] = [];
  const merged: number[] = [];
  let gained = 0;
  for (const line of linesFor(direction)) {
    const slots: { id: number; value: number; merged: boolean }[] = [];
    for (const cell of line) {
      const tile = grid[cell];
      if (!tile) continue;
      const last = slots[slots.length - 1];
      // A tile produced by a merge can never merge again in the same move.
      if (last && !last.merged && last.value === tile.value) { last.value *= 2; last.merged = true; gained += last.value; }
      else slots.push({ id: tile.id, value: tile.value, merged: false });
    }
    slots.forEach((slot, i) => {
      const cell = line[i];
      tiles.push({ id: slot.id, value: slot.value, row: rowOf(cell), col: colOf(cell) });
      if (slot.merged) merged.push(slot.id);
    });
  }
  // Movement is a change of cell contents, so compare by cell rather than by compacted line.
  const after = Array.from({ length: CELLS }, () => 0);
  for (const tile of tiles) after[tile.row * SIZE + tile.col] = tile.value;
  if (before.every((value, cell) => value === after[cell])) return { game, moved: false, gained: 0, merged: [], spawned: null };
  const spawned = spawnTile({ ...game, tiles, score: game.score + gained, moves: game.moves + 1 });
  return { game: spawned.game, moved: true, gained, merged, spawned: spawned.spawned };
}

export const acknowledgeWin = (game: Game2048): Game2048 => game.won ? game : { ...game, won: true };
