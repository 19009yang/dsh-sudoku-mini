import { styles } from './styles.ts';
import { readSettings, saveSettings } from './storage.ts';
import { g2048Tool } from './tools/g2048.ts';
import { sudokuTool } from './tools/sudoku.ts';
import type { ToolContext, ToolInstance, ToolModule } from './tools/types.ts';

const launcherIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="7" cy="7" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>';
const extensionIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

/** A menu entry is either a real tool or a reserved slot that only reports itself. */
interface Feature { id: string; label: string; icon: string; available: boolean; regionLabel: string; mount?: ToolModule['mount'] }

const features: Feature[] = [
  { ...sudokuTool, available: true },
  { ...g2048Tool, available: true },
  { id: 'extension-two', label: '扩展功能二', icon: extensionIcon, available: false, regionLabel: '' },
];

export function createWidget(container: HTMLElement): { destroy(): void } {
  const host = document.createElement('div'); host.dataset.sudokuMini = ''; host.lang = 'zh-CN'; host.dir = 'ltr'; host.style.pointerEvents = 'none'; container.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const featureMarkup = features.map(feature => `<button class="feature-button" type="button" data-feature="${feature.id}" aria-label="${feature.available ? '打开' : ''}${feature.label}${feature.available ? '' : '，敬请期待'}"${feature.available ? '' : ' aria-disabled="true"'} tabindex="-1" title="${feature.available ? feature.label : `${feature.label} · 敬请期待`}">${feature.icon}</button>`).join('');
  root.innerHTML = `<style>${styles}</style><div class="launcher-group" data-menu-open="false" data-quadrant="bottom-right"><div class="feature-menu" id="feature-menu" role="group" aria-label="功能菜单" aria-hidden="true">${featureMarkup}</div><button class="launcher" type="button" aria-label="打开功能菜单" aria-expanded="false" aria-controls="feature-menu" title="功能菜单 · 拖动可移动">${launcherIcon}</button><span class="launcher-status" role="status" aria-live="polite"></span></div><section class="panel" role="region" hidden></section>`;
  const el = <T extends HTMLElement = HTMLElement>(selector: string): T => { const found = root.querySelector<T>(selector); if (!found) throw new Error(`缺少组件 ${selector}`); return found; };
  const launcherGroup = el('.launcher-group'), featureMenu = el('.feature-menu'), launcher = el<HTMLButtonElement>('.launcher');
  const panel = el('.panel'), settings = readSettings();
  let active: { feature: Feature; instance: ToolInstance } | null = null;
  let menuOpen = false, destroyed = false, suppressClick = false;
  const cleanup: (() => void)[] = [];
  let drag: { target: HTMLElement; id: number; startX: number; startY: number; x: number; y: number; moved: boolean; panel: boolean } | null = null;

  function persistSettings(): void { saveSettings(settings); host.dataset.theme = settings.theme; }
  function notify(text: string): void { const notice = panel.querySelector('.notice'); if (notice) notice.textContent = text; }
  function position(): void {
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight;
    const ox = viewport?.offsetLeft ?? 0, oy = viewport?.offsetTop ?? 0;
    const clamp = (n: number, max: number) => Math.max(12, Math.min(Math.max(12, max - 60), n));
    const x = clamp(settings.position ? settings.position.x * width : width - 68, width);
    const y = clamp(settings.position ? settings.position.y * height : height - 144, height);
    launcherGroup.style.left = `${x + ox}px`; launcherGroup.style.top = `${y + oy}px`;
    launcherGroup.dataset.quadrant = `${y + 24 < height / 2 ? 'top' : 'bottom'}-${x + 24 < width / 2 ? 'left' : 'right'}`;
    panel.style.maxHeight = `${Math.max(120, height - 24)}px`;
    if (active) {
      const w = panel.offsetWidth || Math.min(340, width - 24), h = panel.offsetHeight || 500;
      panel.style.left = `${ox + Math.max(12, Math.min(width - w - 12, x + 48 - w))}px`;
      panel.style.top = `${oy + Math.max(12, Math.min(height - h - 12, y >= h + 24 ? y - h - 8 : y + 56))}px`;
    }
  }
  const ctx: ToolContext = { host, settings, position, notify, saveSettings: persistSettings, close };
  function on(target: EventTarget, name: string, handler: EventListener, capture = false): void { target.addEventListener(name, handler, capture); cleanup.push(() => target.removeEventListener(name, handler, capture)); }
  function setMenuOpen(value: boolean): void {
    menuOpen = value;
    launcherGroup.dataset.menuOpen = String(value);
    featureMenu.setAttribute('aria-hidden', String(!value));
    launcher.setAttribute('aria-expanded', String(value));
    launcher.setAttribute('aria-label', value ? '收起功能菜单' : '打开功能菜单');
    for (const feature of root.querySelectorAll<HTMLButtonElement>('.feature-button')) feature.tabIndex = value ? 0 : -1;
    position();
  }
  function syncFeatureLabels(): void {
    for (const feature of features) {
      const button = root.querySelector<HTMLButtonElement>(`[data-feature="${feature.id}"]`);
      if (!feature.available || !button) continue;
      button.setAttribute('aria-label', `${active?.feature.id === feature.id ? '收起' : '打开'}${feature.label}`);
    }
  }
  function close(): void {
    if (!active) return;
    const hadFocus = root.activeElement !== null && panel.contains(root.activeElement);
    const instance = active.instance;
    active = null;
    panel.hidden = true;
    instance.destroy();
    panel.replaceChildren();
    panel.removeAttribute('role'); panel.removeAttribute('aria-label'); delete panel.dataset.paused;
    host.dataset.theme = settings.theme;
    if (hadFocus) launcher.focus({ preventScroll: true });
    syncFeatureLabels(); position();
  }
  function openFeature(feature: Feature): void {
    if (active?.feature.id === feature.id) { close(); return; }
    if (!feature.available || !feature.mount) { el('.launcher-status').textContent = `${feature.label}尚未开放`; return; }
    if (active) close();
    panel.hidden = false;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', feature.regionLabel);
    active = { feature, instance: feature.mount(panel, ctx) };
    syncFeatureLabels(); position();
  }
  const beginDrag = (event: Event, panelDrag: boolean, handle?: HTMLElement): void => {
    const e = event as PointerEvent; if (e.button !== 0 || panelDrag && window.innerWidth <= 400) return;
    const target = handle ?? e.currentTarget as HTMLElement, box = (panelDrag ? panel : launcherGroup).getBoundingClientRect();
    drag = { target, id: e.pointerId, startX: e.clientX, startY: e.clientY, x: box.left, y: box.top, moved: false, panel: panelDrag }; target.setPointerCapture(e.pointerId); suppressClick = false;
  };
  const moveDrag = (event: Event): void => {
    const e = event as PointerEvent; if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved && !drag.panel) setMenuOpen(false);
    drag.moved = true; const target = drag.panel ? panel : launcherGroup;
    target.style.left = `${Math.max(12, Math.min(window.innerWidth - target.offsetWidth - 12, drag.x + dx))}px`; target.style.top = `${Math.max(12, Math.min(window.innerHeight - target.offsetHeight - 12, drag.y + dy))}px`;
  };
  const endDrag = (event: Event): void => {
    const e = event as PointerEvent; if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved) {
      if (drag.panel) { const b = panel.getBoundingClientRect(); settings.position = { x: Math.max(0, Math.min(1, (b.right - 48) / window.innerWidth)), y: Math.max(0, Math.min(1, (b.bottom + 8) / window.innerHeight)) }; }
      else { const b = launcherGroup.getBoundingClientRect(); settings.position = { x: b.left / window.innerWidth, y: b.top / window.innerHeight }; suppressClick = true; position(); }
      persistSettings();
    }
    if (drag.target.hasPointerCapture(e.pointerId)) drag.target.releasePointerCapture(e.pointerId); drag = null;
  };
  const click = (selector: string, fn: () => void) => on(el(selector), 'click', () => fn());
  click('.launcher', () => { if (suppressClick) { suppressClick = false; return; } setMenuOpen(!menuOpen); });
  for (const feature of features) click(`[data-feature="${feature.id}"]`, () => { if (feature.available) setMenuOpen(false); openFeature(feature); });
  on(root, 'keydown', event => {
    const e = event as KeyboardEvent;
    if (e.isComposing) return;
    if (e.key === 'Escape' && menuOpen) { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); launcher.focus({ preventScroll: true }); }
  }, true);
  on(launcher, 'pointerdown', e => beginDrag(e, false));
  on(panel, 'pointerdown', e => { const node = e.target; const title = node instanceof Element ? node.closest('.title') : null; if (title instanceof HTMLElement) beginDrag(e, true, title); });
  for (const target of [launcher, panel]) { on(target, 'pointermove', moveDrag); on(target, 'pointerup', endDrag); on(target, 'pointercancel', endDrag); }
  on(window, 'resize', position);
  if (window.visualViewport) on(window.visualViewport, 'resize', position);
  host.dataset.theme = settings.theme; syncFeatureLabels(); position();
  return {
    destroy() {
      if (destroyed) return; destroyed = true;
      if (active) { const instance = active.instance; active = null; panel.hidden = true; instance.destroy(); panel.replaceChildren(); }
      menuOpen = false;
      for (const dispose of cleanup.reverse()) dispose();
      if (drag && drag.target.hasPointerCapture(drag.id)) drag.target.releasePointerCapture(drag.id);
      drag = null; host.remove();
    },
  };
}
