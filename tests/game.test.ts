import { describe, expect, it } from 'vitest';
import { bit, conflicts, isComplete, parseGrid, peers } from '../src/game/rules.ts';
import { createGame, puzzles } from '../src/game/puzzles.ts';
import { reduceGame } from '../src/game/reducer.ts';
import { getHint } from '../src/game/hints.ts';

describe('game rules and actions', () => {
  it('has exactly 20 unique symmetric peers per cell', () => {
    for (let i = 0; i < 81; i++) { expect(peers[i]).toHaveLength(20); expect(new Set(peers[i]).size).toBe(20); expect(peers[i]).not.toContain(i); for (const p of peers[i]) expect(peers[p]).toContain(i); }
  });
  it('marks duplicates in all three units and rejects full invalid boards', () => {
    const values = Array(81).fill(0); values[0] = values[1] = values[9] = 1;
    expect([...conflicts(values)].sort((a, b) => a - b)).toEqual([0, 1, 9]);
    expect(isComplete(Array(81).fill(1))).toBe(false);
    expect(isComplete(parseGrid(puzzles[0].solution))).toBe(true);
  });
  it('protects givens and does not add no-op undo entries', () => {
    let game = createGame(puzzles[0], 42); const i = game.givens.findIndex(Boolean);
    game = reduceGame(game, { type: 'select', index: i });
    expect(reduceGame(game, { type: 'erase' })).toBe(game);
    expect(reduceGame(game, { type: 'enter', digit: 2 })).toBe(game);
    game = reduceGame(game, { type: 'select', index: game.givens.findIndex(v => !v) });
    expect(reduceGame(game, { type: 'erase' })).toBe(game);
  });
  it('undo restores a compound fill and every cleaned peer note', () => {
    let game = createGame(puzzles[0], 42); const index = game.givens.findIndex(v => !v), d = game.solution[index];
    const peer = peers[index].find(p => !game.givens[p])!;
    game = { ...game, selectedCell: index, notes: game.notes.map((_, i) => i === peer ? bit(d) : 0) };
    const before = game;
    game = reduceGame(game, { type: 'enter', digit: d });
    expect(game.notes[peer]).toBe(0); expect(game.history).toHaveLength(1);
    game = reduceGame(game, { type: 'undo' });
    expect(game.values).toEqual(before.values); expect(game.notes).toEqual(before.notes);
  });
  it('notes replace an editable value and can be undone', () => {
    let game = createGame(puzzles[0], 42);
    game = reduceGame(game, { type: 'enter', digit: 4 }); const index = game.selectedCell!;
    game = reduceGame(game, { type: 'noteMode' }); game = reduceGame(game, { type: 'enter', digit: 2 });
    expect(game.values[index]).toBe(0); expect(game.notes[index]).toBe(bit(2));
    game = reduceGame(game, { type: 'undo' }); expect(game.values[index]).toBe(4); expect(game.notes[index]).toBe(0);
  });
  it('wins only on a valid completed board; undo restores play without reducing time or hints', () => {
    let game = createGame(puzzles[0], 42); const index = game.selectedCell!;
    game = { ...game, values: [...game.solution], elapsedMs: 1234 }; game.values[index] = 0;
    game = reduceGame(game, { type: 'hint', index, digit: game.solution[index] });
    expect(game.status).toBe('won'); expect(game.hintCount).toBe(1);
    game = reduceGame(game, { type: 'undo' }); expect(game.status).toBe('playing'); expect(game.hintCount).toBe(1); expect(game.elapsedMs).toBe(1234);
  });
  it('does not derive hints from a mistaken player board', () => {
    let game = createGame(puzzles[0], 42); const index = game.selectedCell!;
    const digit = game.solution[index] === 1 ? 2 : 1; game = reduceGame(game, { type: 'enter', digit });
    expect(getHint(game)?.kind).toBe('error'); expect(getHint(game)?.index).toBe(index);
  });
});
