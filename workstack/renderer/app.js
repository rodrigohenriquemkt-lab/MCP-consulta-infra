'use strict';
const COLORS = ['red', 'orange', 'yellow', 'green', 'blue'];
const ICONS = { email: '✉', chat: '💬', meeting: '📅', task: '☑', whatsapp: '📱', manual: '✎' };
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
    const ok = el('button', null, '✓'); ok.title = 'Concluir (remove da lista)'; ok.onclick = () => window.ws.done(i.id, true);
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
const eye = document.getElementById('watch');
const showWatch = (on) => { eye.textContent = on ? '👁' : '🚫'; eye.title = on ? 'Observando Outlook/Teams (clique para pausar)' : 'Observação pausada'; };
eye.onclick = () => window.ws.toggleWatch().then(showWatch);
window.ws.watchState().then(showWatch);
const auto = document.getElementById('auto');
const showAuto = (on) => { auto.style.opacity = on ? '1' : '.4'; auto.title = on ? 'Abre com o Windows (clique para desativar)' : 'Não abre com o Windows (clique para ativar)'; };
auto.onclick = () => window.ws.toggleAuto().then(showAuto);
window.ws.autoState().then(showAuto);
document.getElementById('quit').onclick = () => window.ws.close();
window.ws.onItems((x) => { items = x; render(); });
window.ws.list().then((x) => { items = x; render(); });
