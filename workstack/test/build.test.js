'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { buildInbox } = require('../connectors/build');

const now = Date.parse('2026-10-06T12:00:00Z');

test('coleta crua vira arquivo de troca; tipo em failed ou ausente não entra em okKinds', () => {
  const out = buildInbox({
    email: [{ id: 'm1', isRead: false, subject: 'Proposta' }, { id: 'm2', isRead: true, subject: 'Lido' }],
    chat: [],
    meeting: [{ id: 'e1', subject: 'Cliente', start: { dateTime: new Date(now + 3600e3).toISOString() } }],
    task: [],
    failed: ['task'],
  }, { now });
  assert.deepStrictEqual(out.okKinds, ['email', 'chat', 'meeting']);
  assert.deepStrictEqual(out.items.map((i) => i.kind).sort(), ['email', 'meeting']);
});

test('tudo falhou: okKinds vazia (nada será concluído por engano)', () => {
  const out = buildInbox({ failed: ['email', 'chat', 'meeting', 'task', 'whatsapp'] }, { now });
  assert.deepStrictEqual(out.okKinds, []);
  assert.deepStrictEqual(out.items, []);
});
