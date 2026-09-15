// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { createGame, puzzles } from '../src/game/puzzles.ts';
import { reduceGame } from '../src/game/reducer.ts';
import { defaultSettings, GAME_KEY, readGame, readSettings, restoreSnapshot, saveGame } from '../src/client/storage.ts';

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
