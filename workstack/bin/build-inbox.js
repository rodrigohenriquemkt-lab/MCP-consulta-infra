#!/usr/bin/env node
'use strict';
// Uso: node bin/build-inbox.js [--me seu@email] < coleta.json > workstack-inbox.json
// Entrada: { email: [...], chat: [...], meeting: [...], whatsapp: [...], failed: ['task'] }
// (listas cruas; `failed` lista os tipos cuja coleta falhou).
// Saída: arquivo de troca lido pelo Workstack. (O app também aceita a coleta crua direto.)
const { buildInbox } = require('../connectors/build');

const meIdx = process.argv.indexOf('--me');
const me = meIdx > 0 ? process.argv[meIdx + 1] : undefined;

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  process.stdout.write(JSON.stringify(buildInbox(JSON.parse(raw), { me }), null, 2));
});
