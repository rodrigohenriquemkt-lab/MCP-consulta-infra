'use strict';
const COLORS = ['red', 'orange', 'yellow', 'green', 'blue'];
const ICONS = { email: '✉', chat: '💬', meeting: '📅', task: '☑', manual: '✎' };
const stack = document.getElementById('stack');
const filters = document.getElementById('filters');
let items = [], filter = null;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text; // textContent: conteúdo externo nunca vira HTML
  return e;
}

function render() {
  stack.replaceChildren();
  items.filter((i) => !filter || i.priority === filter).forEach((i) => {
    const n = el('div', `note ${i.priority}${i.done ? ' done' : ''}`);
    n.append(el('div', 'src', `${ICONS[i.kind] || ''} ${i.source} · ${new Date(i.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`));
    n.append(el('div', 't', i.title));
    if (i.detail) n.append(el('div', 'd', i.detail));
    const tools = el('div', 'tools');
    COLORS.forEach((c) => {
      const d = el('button', 'dot'); d.style.background = `var(--${c})`; d.title = c;
      d.onclick = () => window.ws.priority(i.id, c);
      tools.append(d);
    });
    const ok = el('button', null, i.done ? '↩' : '✓'); ok.onclick = () => window.ws.done(i.id, !i.done);
    const rm = el('button', null, '🗑'); rm.onclick = () => window.ws.remove(i.id);
    tools.append(ok, rm);
    if (i.url) { const go = el('button', null, '↗'); go.onclick = () => window.ws.open(i.url); tools.append(go); }
    n.append(tools);
    stack.append(n);
  });
}

COLORS.forEach((c) => {
  const d = el('button', 'dot'); d.style.background = `var(--${c})`; d.title = `Filtrar ${c}`;
  d.onclick = () => { filter = filter === c ? null : c; [...filters.children].forEach((x) => x.classList.toggle('on', x === d && filter)); render(); };
  filters.append(d);
});

document.getElementById('new').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.value.trim()) { window.ws.add(e.target.value); e.target.value = ''; }
});
document.getElementById('quit').onclick = () => window.ws.close();
window.ws.onItems((x) => { items = x; render(); });
window.ws.list().then((x) => { items = x; render(); });
