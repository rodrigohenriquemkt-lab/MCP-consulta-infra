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

test('novo Outlook (títulos reais): assunto em "Assunto – Conta | Empresa – Outlook"', () => {
  const real = 'RES: Your order PO_US_INC_0000981 has been invoiced - Invoice 163142/ Su pedido PO_US_INC_0000981 fue facturado - Factura 163142 \u2013 Rodrigo Henrique | Gantech \u2013 Outlook';
  const r = parseWindow('olk', real);
  assert.strictEqual(r.kind, 'email');
  assert.ok(r.title.startsWith('RES: Your order') && r.title.endsWith('Factura 163142'));
  // resposta/encaminhamento da mesma conversa não gera nota nova
  assert.strictEqual(parseWindow('olk', real.replace('RES: ', 'ENC: ')).key, r.key);
  // tela principal com a pasta ativa é ignorada
  assert.strictEqual(parseWindow('olk', 'Caixa de Entrada - Rodrigo Henrique | Gantech - Outlook'), null);
  // pasta personalizada pode ser silenciada via lista de ignorados
  const t = 'Clientes - Rodrigo Henrique | Gantech - Outlook';
  assert.ok(parseWindow('olk', t));
  assert.strictEqual(parseWindow('olk', t, { ignore: new Set(['clientes']) }), null);
});

test('Teams: conversa, canal, reunião e telas genéricas', () => {
  assert.strictEqual(parseWindow('ms-teams', 'Chat | Maria Souza | Microsoft Teams').title, 'Maria Souza');
  assert.strictEqual(parseWindow('ms-teams', 'Chat | Bruno Miguel | Gantech | Microsoft Teams').title, 'Bruno Miguel');
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
