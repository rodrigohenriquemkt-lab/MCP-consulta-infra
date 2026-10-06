#!/usr/bin/env node
'use strict';
// Uso:
//   node bin/config.js                       mostra as configurações
//   node bin/config.js inbox "C:\...\workstack-inbox.json"
//   node bin/config.js me seu@email.com      (e-mails enviados por você não viram nota)
//   node bin/config.js relay https://SERVICO.up.railway.app SEU_TOKEN   (ponte na nuvem)
//   node bin/config.js relay off
//   node bin/config.js ignore "Clientes,Projetos"
//   node bin/config.js watch on|off
//   node bin/config.js autostart on|off      (vale após reiniciar o app)
const { settingsPath, load, save, list, relayEndpoint } = require('../settings');

const file = settingsPath();
const [key, ...rest] = process.argv.slice(2);
const val = rest.join(' ');
const s = load(file);
const onoff = (v) => /^(on|true|1|sim)$/i.test(v);

if (key === 'inbox') s.inbox = val || null;
else if (key === 'relay') {
  const [url, token] = rest;
  if (url === 'off') { s.relayUrl = null; s.relayToken = null; }
  else if (!relayEndpoint(url) || !token) { console.error('uso: relay https://servico.up.railway.app TOKEN  |  relay off'); process.exit(2); }
  else { s.relayUrl = url; s.relayToken = token; }
}
else if (key === 'me') s.me = val || null;
else if (key === 'ignore') s.ignore = list(val);
else if (key === 'watch') s.watch = onoff(val);
else if (key === 'autostart') s.autostart = onoff(val);
else if (key) { console.error('chave inválida: inbox | me | relay | ignore | watch | autostart'); process.exit(2); }

if (key) save(file, s);
// nunca imprime o token inteiro
const shown = { ...s, relayToken: s.relayToken ? s.relayToken.slice(0, 4) + '…' : null };
console.log(file + '\n' + JSON.stringify(shown, null, 2));
