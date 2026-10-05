'use strict';
const test = require('node:test');
const assert = require('node:assert');
const n = require('../connectors/normalize');

const now = Date.parse('2026-10-05T12:00:00Z');
const H = 3600e3;

test('email lido e não sinalizado é ignorado; não lido entra', () => {
  assert.strictEqual(n.email({ id: '1', isRead: true }, { now }), null);
  const r = n.email({ id: '2', isRead: false, subject: 'Proposta', importance: 'high' }, { now });
  assert.strictEqual(r.kind, 'email');
  assert.strictEqual(r.priority, 'red');
});

test('reunião: dentro de 24h entra; depois disso, não; <2h é vermelha', () => {
  const soon = n.meeting({ id: 'a', subject: 'Cliente', start: { dateTime: new Date(now + H).toISOString() } }, { now });
  assert.strictEqual(soon.priority, 'red');
  const later = n.meeting({ id: 'b', start: { dateTime: new Date(now + 10 * H).toISOString() } }, { now });
  assert.strictEqual(later.priority, 'red'); // vence em <24h
  assert.strictEqual(n.meeting({ id: 'c', start: { dateTime: new Date(now + 30 * H).toISOString() } }, { now }), null);
  assert.strictEqual(n.meeting({ id: 'd', responseStatus: 'declined', start: new Date(now + H).toISOString() }, { now }), null);
});

test('tarefa concluída é ignorada; vencimento define prioridade', () => {
  assert.strictEqual(n.task({ id: 't1', title: 'x', status: 'completed' }, { now }), null);
  const t = n.task({ id: 't2', title: 'Enviar proposta', due: new Date(now + 48 * H).toISOString() }, { now });
  assert.strictEqual(t.priority, 'orange');
});

test('chat: só menção ou direta sem resposta', () => {
  assert.strictEqual(n.chat({ id: 'c1', text: 'oi' }, { now }), null);
  assert.ok(n.chat({ id: 'c2', mentionsMe: true, text: '@rodrigo' }, { now }));
});
