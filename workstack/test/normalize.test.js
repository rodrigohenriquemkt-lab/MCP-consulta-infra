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

test('build-inbox: tipo com falha não entra em okKinds', () => {
  const { execFileSync } = require('node:child_process');
  const out = JSON.parse(execFileSync('node', [require('path').join(__dirname, '../bin/build-inbox.js')], {
    input: JSON.stringify({ email: [{ id: '1', isRead: false, subject: 'x' }], chat: [], failed: ['chat'] }),
  }));
  assert.deepStrictEqual(out.okKinds, ['email']);
  assert.strictEqual(out.items.length, 1);
});

test('whatsapp: pergunta sem resposta entra; respondida ou grupo sem menção não', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  const t = (h) => new Date(now - h * H).toISOString();
  const open = n.whatsapp({ id: 'w1', chatName: 'Cliente X', messages: [{ text: 'Bom dia', timestamp: t(6) }, { text: 'Consegue me enviar a proposta?', timestamp: t(5) }] }, { now });
  assert.strictEqual(open.kind, 'whatsapp');
  assert.strictEqual(open.priority, 'orange');
  const answered = n.whatsapp({ id: 'w2', messages: [{ text: 'Pode?', timestamp: t(3) }, { text: 'Posso sim', fromMe: true, timestamp: t(2) }] }, { now });
  assert.strictEqual(answered, null);
  assert.strictEqual(n.whatsapp({ id: 'w3', isGroup: true, messages: [{ text: 'Alguém sabe?', timestamp: t(1) }] }, { now }), null);
  assert.ok(n.whatsapp({ id: 'w4', isGroup: true, mentionsMe: true, messages: [{ text: 'Rodrigo, qual o prazo', timestamp: t(1) }] }, { now }));
});
