'use strict';
// Configurações persistentes (sobrevivem a reinícios e ao início automático com o Windows).
// Variáveis de ambiente, quando definidas, têm precedência sobre o arquivo.
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULTS = { inbox: null, ignore: [], watch: true, autostart: false };

// Mesmo local que app.getPath('userData') do Electron para o app "workstack".
function settingsPath(platform = process.platform, env = process.env) {
  const base = platform === 'win32' ? env.APPDATA
    : platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support')
    : env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base || os.homedir(), 'workstack', 'settings.json');
}

function load(file) {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { return { ...DEFAULTS }; }
}

function save(file, s) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(s, null, 2));
}

const list = (v) => String(v).split(',').map((x) => x.trim()).filter(Boolean);

function resolve(file, env = process.env) {
  const s = load(file);
  return {
    ...s,
    inbox: env.WORKSTACK_INBOX || s.inbox,
    ignore: env.WORKSTACK_IGNORE ? list(env.WORKSTACK_IGNORE) : s.ignore,
    watch: env.WORKSTACK_WATCH === '0' ? false : s.watch,
  };
}

module.exports = { DEFAULTS, settingsPath, load, save, resolve, list };
