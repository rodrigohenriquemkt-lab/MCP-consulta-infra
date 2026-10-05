#!/usr/bin/env node
'use strict';
// Uso: echo '[...itens crus...]' | node bin/push.js <email|chat|meeting|task> [--me seu@email]
// Normaliza, filtra pelo critério e envia ao Workstack em execução.
const http = require('http');
const { normalizeAll, NORMALIZERS } = require('../connectors/normalize');

const kind = process.argv[2];
if (!NORMALIZERS[kind]) { console.error('tipo inválido: use email|chat|meeting|task'); process.exit(2); }
const meIdx = process.argv.indexOf('--me');
const me = meIdx > 0 ? process.argv[meIdx + 1] : undefined;
const port = Number(process.env.WORKSTACK_PORT || 47800);

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  const items = normalizeAll(kind, JSON.parse(raw), { me });
  if (!items.length) { console.log('0 itens passaram no critério'); return; }
  const req = http.request({ host: '127.0.0.1', port, path: '/ingest', method: 'POST',
    headers: { 'content-type': 'application/json' } }, (res) => {
    res.resume();
    res.on('end', () => console.log(`${items.length} itens enviados (HTTP ${res.statusCode})`));
  });
  req.on('error', (e) => { console.error('Workstack não está rodando?', e.message); process.exit(1); });
  req.end(JSON.stringify(items));
});
