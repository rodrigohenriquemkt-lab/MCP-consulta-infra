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

test('sync não conclui itens abertos pelo observador (origin=watch)', () => {
  const s = createStore();
  s.upsert({ title: 'Maria', kind: 'chat', source: 'teams', externalId: 'teams:maria', origin: 'watch' });
  s.sync([], ['chat']);
  assert.strictEqual(s.list()[0].done, false);
});

test('e-mail de convite e evento do calendário com o mesmo assunto viram uma nota só', () => {
  const s = createStore();
  const mail = s.upsert({ title: 'Convite: Reunião ACME @ seg 6 out', kind: 'email', source: 'outlook', externalId: 'm1', startedAt: 1000 });
  s.setPriority(mail.id, 'blue');
  const ev = s.upsert({ title: 'Reunião ACME', kind: 'meeting', source: 'calendar', externalId: 'e1', due: 9000, url: 'https://x', startedAt: 2000 });
  assert.strictEqual(s.list().length, 1);
  assert.strictEqual(ev.id, mail.id);
  assert.strictEqual(ev.kind, 'meeting');
  assert.strictEqual(ev.due, 9000);
  assert.strictEqual(ev.priority, 'blue'); // cor escolhida é preservada
  assert.strictEqual(ev.startedAt, 1000); // mantém a posição da mais antiga
});

test('reenvio do mesmo evento não recria a nota (alias)', () => {
  const s = createStore();
  s.upsert({ title: 'Reunião ACME', kind: 'email', source: 'outlook', externalId: 'm1' });
  s.upsert({ title: 'Reunião ACME', kind: 'meeting', source: 'calendar', externalId: 'e1' });
  s.upsert({ title: 'Reunião ACME (título editado)', kind: 'meeting', source: 'calendar', externalId: 'e1' });
  assert.strictEqual(s.list().length, 1);
});

test('chats e e-mails com o mesmo texto não se misturam; assuntos diferentes não se unem', () => {
  const s = createStore();
  s.upsert({ title: 'Bruno Miguel', kind: 'chat', source: 'teams', externalId: 'c1' });
  s.upsert({ title: 'Bruno Miguel', kind: 'email', source: 'outlook', externalId: 'm1' });
  s.upsert({ title: 'Proposta A', kind: 'email', source: 'outlook', externalId: 'm2' });
  s.upsert({ title: 'Proposta B', kind: 'email', source: 'outlook', externalId: 'm3' });
  assert.strictEqual(s.list().length, 4);
});

test('item aberto pelo usuário não é concluído pela coleta quando some da origem', () => {
  const s = createStore();
  s.upsert({ title: 'Contrato X', kind: 'email', source: 'outlook', externalId: 'm1' });
  s.upsert({ title: 'RES: Contrato X', kind: 'email', source: 'outlook', externalId: 'w:contrato x', origin: 'watch' });
  s.sync([], ['email']); // e-mail foi lido, saiu da coleta
  assert.strictEqual(s.list().length, 1);
  assert.strictEqual(s.list()[0].done, false);
});
