#!/usr/bin/env node
'use strict';
// Uso: node bin/build-inbox.js [--me seu@email] < coleta.json > workstack-inbox.json
// Entrada: { email: [...], chat: [...], meeting: [...], task: [...], failed: ['chat'] }
// (listas cruas no formato Graph; `failed` lista os tipos cuja coleta falhou)
// Saída: arquivo de troca lido pelo Workstack (WORKSTACK_INBOX).
const { normalizeAll, NORMALIZERS } = require('../connectors/normalize');

const meIdx = process.argv.indexOf('--me');
const me = meIdx > 0 ? process.argv[meIdx + 1] : undefined;

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  const input = JSON.parse(raw);
  const failed = new Set(input.failed || []);
  const kinds = Object.keys(NORMALIZERS);
  const okKinds = kinds.filter((k) => !failed.has(k) && Array.isArray(input[k]));
  const items = okKinds.flatMap((k) => normalizeAll(k, input[k], { me }));
  process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), okKinds, items }, null, 2));
});
