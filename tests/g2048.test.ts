import { expect, it } from 'vitest';
import { acknowledgeWin, createGame, hasMoves, linesFor, maxTile, move, spawnTile } from '../src/game2048/engine.ts';
import type { Direction, Game2048, Tile } from '../src/game2048/types.ts';

const board = (rows: number[][]): Game2048 => {
  const tiles: Tile[] = [];
  let id = 1;
  rows.forEach((values, row) => values.forEach((value, col) => { if (value) tiles.push({ id: id++, value, row, col }); }));
  return { tiles, score: 0, seed: 1, nextId: id, moves: 0, won: false, status: 'playing' };
};
const values = (game: Game2048): number[][] => {
  const grid = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (const tile of game.tiles) grid[tile.row][tile.col] = tile.value;
  return grid;
};

it('orders every line from the edge tiles travel toward', () => {
  expect(linesFor('left')[0]).toEqual([0, 1, 2, 3]);
  expect(linesFor('right')[0]).toEqual([3, 2, 1, 0]);
  expect(linesFor('up')[0]).toEqual([0, 4, 8, 12]);
  expect(linesFor('down')[0]).toEqual([12, 8, 4, 0]);
});

it('slides and merges each tile at most once per move', () => {
  expect(values(move(board([[2, 2, 2, 2]]), 'left').game)[0]).toEqual([4, 4, 0, 0]);
  expect(values(move(board([[4, 4, 4, 0]]), 'left').game)[0]).toEqual([8, 4, 0, 0]);
  expect(values(move(board([[2, 2, 4, 0]]), 'left').game)[0]).toEqual([4, 4, 0, 0]);
  expect(values(move(board([[2, 0, 2, 4]]), 'left').game)[0]).toEqual([4, 4, 0, 0]);
  expect(values(move(board([[0, 0, 2, 0]]), 'right').game)[0]).toEqual([0, 0, 0, 2]);
  expect(values(move(board([[2, 0, 0, 0]]), 'right').game)[0]).toEqual([0, 0, 0, 2]);
  expect(values(move(board([[2, 0, 0, 0], [4, 0, 0, 0], [0, 0, 0, 0], [8, 0, 0, 0]]), 'up').game).map(row => row[0])).toEqual([2, 4, 8, 0]);
  expect(values(move(board([[2, 0, 0, 0], [4, 0, 0, 0], [0, 0, 0, 0], [8, 0, 0, 0]]), 'down').game).map(row => row[0])).toEqual([0, 2, 4, 8]);
});

it('keeps the first tile id of a merge and reports the gained score', () => {
  const outcome = move(board([[2, 2, 0, 0]]), 'left');
  expect(outcome.merged).toEqual([1]);
  expect(outcome.game.tiles.find(tile => tile.id === 1)?.value).toBe(4);
  expect(outcome.gained).toBe(4); expect(outcome.game.score).toBe(4);
  expect(outcome.spawned).not.toBeNull(); expect(outcome.game.tiles).toHaveLength(2);
  expect(outcome.game.moves).toBe(1);
});

it('rejects a move that changes nothing and spawns no tile', () => {
  const stuck = board([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]);
  const outcome = move(stuck, 'left');
  expect(outcome.moved).toBe(false); expect(outcome.spawned).toBeNull(); expect(outcome.gained).toBe(0);
  expect(outcome.game).toBe(stuck);
  expect(spawnTile(stuck).spawned).toBeNull(); expect(spawnTile(stuck).game.status).toBe('over');
});

it('detects wins and recalls an acknowledged one', () => {
  const won = move(board([[1024, 1024, 0, 0]]), 'left').game;
  expect(maxTile(won.tiles)).toBe(2048);
  expect(won.won).toBe(false);
  expect(acknowledgeWin(won).won).toBe(true);
  expect(acknowledgeWin(acknowledgeWin(won)).won).toBe(true);
});

it('spawns only 2s and 4s into free cells and stays reproducible from the stored seed', () => {
  const start = createGame(2024);
  expect(start.tiles).toHaveLength(2);
  expect(start.tiles.every(tile => tile.value === 2 || tile.value === 4)).toBe(true);
  expect(createGame(2024).tiles).toEqual(start.tiles);
  const spawned = spawnTile(board([[2, 0, 0, 0]]));
  expect(spawned.spawned).toBe(2);
  expect(spawned.game.tiles).toHaveLength(2);
  expect(spawned.game.tiles.some(tile => tile.row === 0 && tile.col === 0 && tile.value === 2)).toBe(true);
  let game = start;
  for (const direction of ['left', 'down', 'right', 'up'] as Direction[]) game = move(game, direction).game;
  expect(new Set(game.tiles.map(tile => `${tile.row}:${tile.col}`)).size).toBe(game.tiles.length);
  expect(hasMoves(game.tiles)).toBe(true);
});
