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
