'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseWindow } = require('../watcher/window');

test('Outlook clássico: item aberto em janela própria', () => {
  const r = parseWindow('OUTLOOK', 'Proposta ACME - renovação  -  Mensagem (HTML)');
  assert.deepStrictEqual([r.kind, r.title, r.source], ['email', 'Proposta ACME - renovação', 'outlook']);
  assert.strictEqual(parseWindow('OUTLOOK', 'Reunião de alinhamento  -  Reunião').kind, 'meeting');
  assert.strictEqual(parseWindow('OUTLOOK', 'Enviar contrato  -  Tarefa').kind, 'task');
});

test('Outlook: janela principal e pastas são ignoradas', () => {
  assert.strictEqual(parseWindow('OUTLOOK', 'Caixa de Entrada - rodrigo@gantech.com.br - Outlook'), null);
  assert.strictEqual(parseWindow('olk', 'Mail - Rodrigo Henrique - Outlook'), null);
  assert.strictEqual(parseWindow('olk', 'Calendário - Outlook'), null);
});

test('novo Outlook: janela destacada com 2 partes', () => {
  const r = parseWindow('olk', 'Contrato Fazenda Boa Vista - Outlook');
  assert.strictEqual(r.title, 'Contrato Fazenda Boa Vista');
});

test('Teams: conversa, canal, reunião e telas genéricas', () => {
  assert.strictEqual(parseWindow('ms-teams', 'Chat | Maria Souza | Microsoft Teams').title, 'Maria Souza');
  assert.strictEqual(parseWindow('ms-teams', '(3) Chat | Maria Souza | Microsoft Teams').key, 'maria souza');
  assert.strictEqual(parseWindow('ms-teams', 'Geral | Vendas | Microsoft Teams').title, 'Geral · Vendas');
  assert.strictEqual(parseWindow('ms-teams', 'Reunião com João | Microsoft Teams').kind, 'meeting');
  assert.strictEqual(parseWindow('ms-teams', 'Calendário | Microsoft Teams'), null);
  assert.strictEqual(parseWindow('ms-teams', 'Microsoft Teams'), null);
});

test('qualquer outro app é ignorado (privacidade)', () => {
  assert.strictEqual(parseWindow('chrome', 'Banco - Extrato | Google Chrome'), null);
  assert.strictEqual(parseWindow('WhatsApp', 'WhatsApp'), null);
});
