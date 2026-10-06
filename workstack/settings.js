'use strict';
// Configurações persistentes (sobrevivem a reinícios e ao início automático com o Windows).
// Variáveis de ambiente, quando definidas, têm precedência sobre o arquivo.
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULTS = { inbox: null, ignore: [], watch: true, autostart: false, me: null, relayUrl: null, relayToken: null };

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
    me: env.WORKSTACK_ME || s.me,
    relayUrl: env.WORKSTACK_RELAY_URL || s.relayUrl,
    relayToken: env.WORKSTACK_RELAY_TOKEN || s.relayToken,
  };
}

// Só aceita HTTPS (o token viaja no cabeçalho); http apenas para testes em localhost.
function relayEndpoint(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(u.hostname)) return null;
    return u.origin + u.pathname.replace(/\/$/, '') + '/inbox';
  } catch { return null; }
}

module.exports = { relayEndpoint, DEFAULTS, settingsPath, load, save, resolve, list };
