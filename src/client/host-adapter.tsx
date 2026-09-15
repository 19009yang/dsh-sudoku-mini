import { createElement, useEffect, useRef } from 'react';
import { createWidget } from './widget.ts';

/** React belongs to the host; the game DOM and lifecycle belong to the widget. */
export function SudokuOverlay() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const widget = createWidget(container.current);
    return () => widget.destroy();
  }, []);

  return createElement('div', {
    ref: container,
    'data-dsh-sudoku-mini': '',
    style: { pointerEvents: 'none' },
  });
}
