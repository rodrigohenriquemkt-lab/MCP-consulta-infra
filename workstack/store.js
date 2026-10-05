'use strict';
// Lógica pura da pilha de atividades (sem Electron), para ser testável.

const PRIORITIES = ['red', 'orange', 'yellow', 'green', 'blue'];
const DEFAULT_PRIORITY = 'yellow';
const KINDS = ['email', 'chat', 'meeting', 'task', 'whatsapp', 'manual'];

function createStore(initial = []) {
  let items = Array.isArray(initial) ? initial.slice() : [];
  let seq = items.reduce((m, i) => Math.max(m, Number(i.id) || 0), 0);

  // Idempotente: se source+externalId já existe, atualiza em vez de duplicar.
  function upsert(input) {
    const title = String(input.title || '').trim();
    if (!title) throw new Error('title é obrigatório');
    const source = input.source || 'manual';
    const existing = input.externalId
      ? items.find((i) => i.source === source && i.externalId === input.externalId)
      : null;
    if (existing) {
      Object.assign(existing, {
        title,
        detail: input.detail ?? existing.detail,
        url: input.url ?? existing.url,
        due: input.due ?? existing.due,
      });
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
      kind: KINDS.includes(input.kind) ? input.kind : 'manual',
      due: input.due ? new Date(input.due).getTime() : null,
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
      if (it.origin !== 'watch' && it.externalId && okKinds.includes(it.kind) && !seen.has(it.id)) it.done = true;
    });
  }

  return { upsert, sync, setPriority, setDone, remove, list, snapshot: () => items.slice() };
}

module.exports = { createStore, PRIORITIES, KINDS };
