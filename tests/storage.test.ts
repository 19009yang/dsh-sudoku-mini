// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { createGame, puzzles } from '../src/game/puzzles.ts';
import { reduceGame } from '../src/game/reducer.ts';
import { createGame as createGame2048, move } from '../src/game2048/engine.ts';
import { defaultSettings, G2048_KEY, GAME_KEY, readG2048, readG2048Best, readGame, readSettings, restoreG2048, restoreSnapshot, saveG2048, saveGame } from '../src/client/storage.ts';

beforeEach(() => localStorage.clear());
it('restores transformed board, notes, history and elapsed time', () => {
  let game = createGame(puzzles[0], 17); game = reduceGame(game, { type: 'enter', digit: 2 }); game.elapsedMs = 12_345;
  expect(saveGame(game, defaultSettings, 'test-tab', 1)).toBe(true);
  expect(readGame().game).toEqual(game);
});
it('rejects corrupt JSON, unknown schemas, changed fixed cells and forged undo', () => {
  localStorage.setItem(GAME_KEY, '{'); expect(readGame().error).toBe(true);
  let game = createGame(puzzles[0], 17); game = reduceGame(game, { type: 'enter', digit: 2 }); saveGame(game, defaultSettings, 'test', 1);
  const raw = JSON.parse(localStorage.getItem(GAME_KEY)!);
  expect(() => restoreSnapshot({ ...raw, schema: 2 })).toThrow();
  expect(() => restoreSnapshot({ ...raw, values: [1] })).toThrow();
  const values = [...raw.values]; values[game.givens.findIndex(Boolean)] = 0; expect(() => restoreSnapshot({ ...raw, values })).toThrow();
  raw.history[0].after[0].value = 8; expect(() => restoreSnapshot(raw)).toThrow();
});
it('handles denied storage and invalid settings without breaking gameplay', () => {
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } } as unknown as Storage;
  expect(readSettings(blocked)).toEqual(defaultSettings); expect(readGame(blocked).error).toBe(true);
  expect(saveGame(createGame(puzzles[0], 1), defaultSettings, 'test', 1, blocked)).toBe(false);
});
it('trims large history to a valid bounded snapshot', () => {
  let game = createGame(puzzles[0], 17);
  for (let i = 0; i < 220; i++) game = reduceGame(game, { type: 'enter', digit: i % 2 ? 1 : 2 });
  expect(game.history).toHaveLength(200); expect(saveGame(game, defaultSettings, 'test', 1)).toBe(true);
  expect(readGame().error).toBe(false);
});
it('round-trips a 2048 board together with the best score', () => {
  const game = move(createGame2048(7), 'left').game;
  game.score = 128;
  expect(saveG2048(game, 4096)).toBe(true);
  expect(readG2048().game).toEqual(game);
  expect(readG2048Best()).toBe(4096);
  expect(readG2048().error).toBe(false);
  expect(saveG2048(game, -5)).toBe(true); expect(readG2048Best()).toBe(0);
});
it('rejects a 2048 snapshot with an impossible board or forged counters', () => {
  const game = move(createGame2048(7), 'left').game;
  saveG2048(game, 0);
  const raw = JSON.parse(localStorage.getItem(G2048_KEY)!);
  expect(() => restoreG2048({ ...raw, schema: 2 })).toThrow();
  expect(() => restoreG2048({ ...raw, tiles: 'nope' })).toThrow();
  expect(() => restoreG2048({ ...raw, tiles: [...raw.tiles, raw.tiles[0]] })).toThrow();
  expect(() => restoreG2048({ ...raw, tiles: raw.tiles.map((tile: { row: number; col: number }) => ({ ...tile, row: 9, col: 9 })) })).toThrow();
  expect(() => restoreG2048({ ...raw, tiles: raw.tiles.map((tile: object) => ({ ...tile, value: 6 })) })).toThrow();
  expect(() => restoreG2048({ ...raw, tiles: raw.tiles.map((tile: object) => ({ ...tile, id: 999 })) })).toThrow();
  expect(() => restoreG2048({ ...raw, status: 'paused' })).toThrow();
  expect(() => restoreG2048({ ...raw, nextId: 0 })).toThrow();
  expect(restoreG2048(raw).tiles).toHaveLength(raw.tiles.length);
});
it('treats unreadable 2048 storage as a fresh game instead of throwing', () => {
  localStorage.setItem(G2048_KEY, '{'); expect(readG2048()).toEqual({ game: null, error: true });
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } } as unknown as Storage;
  expect(readG2048(blocked).error).toBe(true); expect(readG2048Best(blocked)).toBe(0);
  expect(saveG2048(move(createGame2048(7), 'left').game, 12, blocked)).toBe(false);
});
