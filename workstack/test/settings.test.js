'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const st = require('../settings');

test('padrões, persistência e precedência do ambiente', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ws-')), 'sub', 'settings.json');
  assert.deepStrictEqual(st.load(f), st.DEFAULTS); // arquivo ausente
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
