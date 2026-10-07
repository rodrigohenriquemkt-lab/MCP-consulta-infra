'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const st = require('../settings');

test('padrões, persistência e precedência do ambiente', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ws-')), 'sub', 'settings.json');
  assert.deepStrictEqual(st.load(f), { ...st.DEFAULTS, version: 2 }); // arquivo ausente
  st.save(f, { ...st.DEFAULTS, inbox: 'C:/a.json', autostart: true, ignore: ['Clientes'] });
  const r = st.resolve(f, {});
  assert.strictEqual(r.inbox, 'C:/a.json');
  assert.strictEqual(r.autostart, true);
  const env = st.resolve(f, { WORKSTACK_INBOX: 'D:/b.json', WORKSTACK_IGNORE: 'X, Y', WORKSTACK_WATCH: '0' });
  assert.deepStrictEqual([env.inbox, env.ignore, env.watch], ['D:/b.json', ['X', 'Y'], false]);
});

test('caminho das configurações no Windows', () => {
  assert.strictEqual(st.settingsPath('win32', { APPDATA: 'C:\\Users\\R\\AppData\\Roaming' }).replace(/\\/g, '/'),
    'C:/Users/R/AppData/Roaming/workstack/settings.json');
});

test('ponte: só HTTPS (ou localhost) e monta o endereço /inbox', () => {
  assert.strictEqual(st.relayEndpoint('https://x.up.railway.app'), 'https://x.up.railway.app/inbox');
  assert.strictEqual(st.relayEndpoint('https://x.up.railway.app/'), 'https://x.up.railway.app/inbox');
  assert.strictEqual(st.relayEndpoint('http://localhost:3000'), 'http://localhost:3000/inbox');
  assert.strictEqual(st.relayEndpoint('http://x.up.railway.app'), null); // token em texto puro: recusado
  assert.strictEqual(st.relayEndpoint('lixo'), null);
});

test('início automático: ligado por padrão e atalho na pasta de Inicialização', () => {
  assert.strictEqual(st.DEFAULTS.autostart, true);
  assert.strictEqual(st.startupShortcutPath('C:\\Users\\R\\AppData\\Roaming').replace(/\\/g, '/'),
    'C:/Users/R/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/Workstack.lnk');
});

test('migração: autostart:false salvo pelo padrão antigo é descartado; escolha da v2 é respeitada', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ws-')), 'settings.json');
  fs.writeFileSync(f, JSON.stringify({ watch: true, autostart: false, inbox: 'C:/a.json' })); // sem version
  const migrated = st.load(f);
  assert.strictEqual(migrated.autostart, true);
  assert.strictEqual(migrated.inbox, 'C:/a.json'); // demais valores preservados
  st.save(f, { ...migrated, autostart: false }); // usuário desliga de propósito (v2)
  assert.strictEqual(st.load(f).autostart, false);
});
