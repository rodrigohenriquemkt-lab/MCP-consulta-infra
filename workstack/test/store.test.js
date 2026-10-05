'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createStore } = require('../store');

test('empilha por ordem de início (mais nova no topo)', () => {
  const s = createStore();
  s.upsert({ title: 'A', startedAt: 1000 });
  s.upsert({ title: 'B', startedAt: 2000 });
  assert.deepStrictEqual(s.list().map((i) => i.title), ['B', 'A']);
});

test('não duplica item com mesmo source+externalId', () => {
  const s = createStore();
  s.upsert({ title: 'Email X', source: 'outlook', externalId: 'm1' });
  s.upsert({ title: 'Email X (atualizado)', source: 'outlook', externalId: 'm1' });
  assert.strictEqual(s.list().length, 1);
  assert.strictEqual(s.list()[0].title, 'Email X (atualizado)');
});

test('prioridade por cor e filtro', () => {
  const s = createStore();
  const a = s.upsert({ title: 'A' });
  s.upsert({ title: 'B' });
  s.setPriority(a.id, 'red');
  assert.deepStrictEqual(s.list({ priority: 'red' }).map((i) => i.title), ['A']);
  assert.throws(() => s.setPriority(a.id, 'pink'));
});

test('concluídas vão para o fim; título obrigatório', () => {
  const s = createStore();
  const a = s.upsert({ title: 'A', startedAt: 2000 });
  s.upsert({ title: 'B', startedAt: 1000 });
  s.setDone(a.id, true);
  assert.deepStrictEqual(s.list().map((i) => i.title), ['B', 'A']);
  assert.throws(() => s.upsert({ title: '  ' }));
});

test('kind e due são preservados; kind inválido vira manual', () => {
  const s = createStore();
  const a = s.upsert({ title: 'R', kind: 'meeting', due: 5000 });
  const b = s.upsert({ title: 'X', kind: 'foo' });
  assert.strictEqual(a.kind, 'meeting');
  assert.strictEqual(a.due, 5000);
  assert.strictEqual(b.kind, 'manual');
});

test('sync marca como concluído o que sumiu, só nos tipos coletados com sucesso', () => {
  const s = createStore();
  s.upsert({ title: 'M1', kind: 'email', source: 'outlook', externalId: 'm1' });
  s.upsert({ title: 'C1', kind: 'chat', source: 'teams', externalId: 'c1' });
  const man = s.upsert({ title: 'minha nota' });
  s.sync([], ['email']); // chat falhou na coleta
  const byTitle = Object.fromEntries(s.list().map((i) => [i.title, i.done]));
  assert.strictEqual(byTitle.M1, true);
  assert.strictEqual(byTitle.C1, false);
  assert.strictEqual(byTitle['minha nota'], false);
});

test('sync preserva a prioridade escolhida pelo usuário', () => {
  const s = createStore();
  const a = s.upsert({ title: 'A', kind: 'task', source: 't', externalId: '1', priority: 'yellow' });
  s.setPriority(a.id, 'blue');
  s.sync([{ title: 'A v2', kind: 'task', source: 't', externalId: '1', priority: 'red' }], ['task']);
  assert.strictEqual(s.list()[0].priority, 'blue');
});
