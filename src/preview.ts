import { createWidget } from './client/widget.ts';
let widget = createWidget(document.body), stream: ReturnType<typeof setInterval> | null = null;
document.querySelector('#send')!.addEventListener('click', () => { if (stream) clearInterval(stream); let n = 0; document.querySelector('#stream')!.textContent = ''; stream = setInterval(() => { document.querySelector('#stream')!.textContent += `输出片段 ${++n}\n`; if (n >= 50 && stream) { clearInterval(stream); stream = null; } }, 100); });
document.querySelector('#stop')!.addEventListener('click', () => { if (stream) clearInterval(stream); stream = null; });
document.querySelector('#approval')!.addEventListener('click', () => document.querySelector('dialog')!.showModal());
document.querySelector('#approve')!.addEventListener('click', () => document.querySelector('dialog')!.close());
document.querySelector('#remount')!.addEventListener('click', () => { widget.destroy(); widget = createWidget(document.body); });
// Accessible only in the unpublished development fixture, never in the plugin bundle.
Object.assign(window, { destroySudoku: () => widget.destroy() });
