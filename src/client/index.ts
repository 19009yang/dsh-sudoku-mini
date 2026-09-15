import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import { SudokuOverlay } from './host-adapter.tsx';

export const inject = ['slots', 'layout'];

/** Add an independent root overlay without touching sessions or agent services. */
export function apply(ctx: Context): void {
  ctx.effect(() =>
    ctx.slots.register(
      { name: 'shell.overlay', id: 'dsh-sudoku-mini', order: 100 },
      SudokuOverlay,
    ),
  );
}
