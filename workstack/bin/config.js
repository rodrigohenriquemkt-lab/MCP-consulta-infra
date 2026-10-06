#!/usr/bin/env node
'use strict';
// Uso:
//   node bin/config.js                       mostra as configurações
//   node bin/config.js inbox "C:\...\workstack-inbox.json"
//   node bin/config.js me seu@email.com      (e-mails enviados por você não viram nota)
//   node bin/config.js ignore "Clientes,Projetos"
//   node bin/config.js watch on|off
//   node bin/config.js autostart on|off      (vale após reiniciar o app)
const { settingsPath, load, save, list } = require('../settings');

const file = settingsPath();
const [key, ...rest] = process.argv.slice(2);
const val = rest.join(' ');
const s = load(file);
const onoff = (v) => /^(on|true|1|sim)$/i.test(v);

if (key === 'inbox') s.inbox = val || null;
else if (key === 'me') s.me = val || null;
else if (key === 'ignore') s.ignore = list(val);
else if (key === 'watch') s.watch = onoff(val);
else if (key === 'autostart') s.autostart = onoff(val);
else if (key) { console.error('chave inválida: inbox | me | ignore | watch | autostart'); process.exit(2); }

if (key) save(file, s);
console.log(file + '\n' + JSON.stringify(s, null, 2));
