'use strict';
// Lógica pura da pilha de atividades (sem Electron), para ser testável.

const PRIORITIES = ['red', 'orange', 'yellow', 'green', 'blue'];
const DEFAULT_PRIORITY = 'yellow';
const KINDS = ['email', 'chat', 'meeting', 'task', 'whatsapp', 'manual'];

// Título normalizado para detectar o mesmo assunto vindo de fontes diferentes
// (e-mail de convite x evento do calendário; e-mail aberto x e-mail coletado).
const STATUS_PREFIX = /^((re|res|enc|fw|fwd|rv|convite|invitation|atualizado|updated|cancelado|canceled|cancelled|aceito|accepted|recusado|declined|provis[óo]rio|tentative)\s*:\s*)+/i;
function normTitle(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(STATUS_PREFIX, '').replace(/\s@\s.*$/, '').replace(/\s+/g, ' ').trim();
}
const mergeable = (k) => k === 'email' || k === 'meeting';

function createStore(initial = []) {
  // Migração: notas criadas pelo observador antes do campo `opened` existir.
  let items = Array.isArray(initial) ? initial.map((i) => (i.origin === 'watch' ? { ...i, opened: true } : i)) : [];
  let seq = items.reduce((m, i) => Math.max(m, Number(i.id) || 0), 0);

  const hasRef = (i, source, externalId) =>
    (i.source === source && i.externalId === externalId) ||
    (i.aliases || []).some((x) => x.source === source && x.externalId === externalId);

  // Idempotente: o mesmo source+externalId (ou um alias dele) atualiza em vez de duplicar.
  // E-mail/reunião com o mesmo assunto vindos de fontes diferentes viram uma nota só
  // (a mais antiga, que mantém posição e cor), guardando a outra origem como alias.
  function upsert(input) {
    const title = String(input.title || '').trim();
    if (!title) throw new Error('title é obrigatório');
    const source = input.source || 'manual';
    const kind = KINDS.includes(input.kind) ? input.kind : 'manual';
    const watched = input.origin === 'watch';
    const due = input.due ? new Date(input.due).getTime() : null;

    let existing = input.externalId ? items.find((i) => hasRef(i, source, input.externalId)) : null;
    let merged = false;
    if (!existing && mergeable(kind)) {
      const k = normTitle(title);
      existing = k ? items.find((i) => mergeable(i.kind) && normTitle(i.title) === k) : null;
      merged = !!existing;
    }

    if (existing) {
      if (merged) {
        if (input.externalId) (existing.aliases = existing.aliases || []).push({ source, externalId: input.externalId });
        if (kind === 'meeting') existing.kind = 'meeting'; // mais específico que e-mail
        if (input.startedAt) existing.startedAt = Math.min(existing.startedAt, new Date(input.startedAt).getTime());
      } else {
        existing.title = title;
      }
      existing.detail = existing.detail || input.detail || '';
      existing.url = input.url ?? existing.url;
      existing.due = due ?? existing.due;
      if (watched) existing.opened = true;
      return existing;
    }

    const item = {
      id: ++seq,
      title,
      detail: input.detail || '',
      source,
      externalId: input.externalId || null,
      url: input.url || null,
      origin: input.origin || 'ingest',
      opened: watched, // aberto pelo usuário: nunca é concluído automaticamente pela coleta
      kind,
      due,
      priority: PRIORITIES.includes(input.priority) ? input.priority : DEFAULT_PRIORITY,
      startedAt: input.startedAt ? new Date(input.startedAt).getTime() : Date.now(),
      done: false,
    };
    items.push(item);
    return item;
  }

  function setPriority(id, priority) {
    if (!PRIORITIES.includes(priority)) throw new Error('prioridade inválida');
    const it = items.find((i) => i.id === id);
    if (it) it.priority = priority;
    return it;
  }

  const setDone = (id, done) => {
    const it = items.find((i) => i.id === id);
    if (it) it.done = !!done;
    return it;
  };
  const remove = (id) => { items = items.filter((i) => i.id !== id); };

  // Ordem de início: a mais antiga embaixo, a mais nova no topo da pilha.
  // Concluídas vão para o fim da lista de exibição.
  function list({ priority } = {}) {
    return items
      .filter((i) => !priority || i.priority === priority)
      .sort((a, b) => Number(a.done) - Number(b.done) || b.startedAt - a.startedAt);
  }

  // Reconcilia com o snapshot de um coletor: insere/atualiza os itens recebidos e
  // marca como concluídos os itens de `okKinds` que sumiram da origem (e-mail lido,
  // reunião passou, tarefa fechada). Tipos que falharam na coleta não são tocados.
  function sync(incoming, okKinds) {
    const seen = new Set();
    incoming.forEach((i) => { const it = upsert(i); seen.add(it.id); });
    items.forEach((it) => {
      if (!it.opened && it.externalId && okKinds.includes(it.kind) && !seen.has(it.id)) it.done = true;
    });
  }

  return { upsert, sync, setPriority, setDone, remove, list, snapshot: () => items.slice() };
}

module.exports = { createStore, PRIORITIES, KINDS, normTitle };
