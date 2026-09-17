import type { Settings } from '../../game/types.ts';

/** Everything a tool panel may use from the widget shell. Tools own their DOM and listeners. */
export interface ToolContext {
  /** Shadow host element; carries `data-theme` for the shared palette. */
  host: HTMLElement;
  settings: Settings;
  /** Re-runs launcher/panel placement after the panel changes size. */
  position(): void;
  notify(text: string): void;
  saveSettings(): void;
  /** Collapses the panel; the shell then destroys this tool. */
  close(): void;
}

export interface ToolInstance { destroy(): void }

export interface ToolModule {
  id: string;
  label: string;
  icon: string;
  /** Accessible name of the panel region this tool renders into. */
  regionLabel: string;
  mount(container: HTMLElement, ctx: ToolContext): ToolInstance;
}
