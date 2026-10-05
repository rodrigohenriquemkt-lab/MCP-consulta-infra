'use strict';
const { app, BrowserWindow, ipcMain, globalShortcut, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createStore } = require('./store');
const { startWatcher } = require('./watcher/window');

const INGEST_PORT = Number(process.env.WORKSTACK_PORT || 47800);
let win, store, file, lastInbox = 0, watcher = null;

const load = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } };
const save = () => fs.writeFileSync(file, JSON.stringify(store.snapshot(), null, 2));
const push = () => win && win.webContents.send('items', store.list());

// Item aberto pelo usuário no Outlook/Teams (via observador de janela) entra na pilha;
// se já existia, não muda de posição; se estava concluído, volta a ficar em andamento.
function onOpened(p) {
  const it = store.upsert({ title: p.title, kind: p.kind, source: p.source, externalId: `${p.source}:${p.key}`, origin: 'watch' });
  if (it.done) store.setDone(it.id, false);
  save(); push();
}
const setWatch = (on) => {
  if (watcher) { watcher.stop(); watcher = null; }
  if (on) { const w = startWatcher(onOpened, { debug: process.env.WORKSTACK_DEBUG_TITLES === '1' }); watcher = w.supported ? w : null; }
  return !!watcher;
};

function createWindow() {
  win = new BrowserWindow({
    width: 320, height: 520, x: 40, y: 40,
    frame: false, transparent: true, resizable: true, hasShadow: false,
    skipTaskbar: true, alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  // 'screen-saver' mantém a janela acima de apps em tela cheia; visível em todos os desktops.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// Porta de entrada para integrações: Claude/MCP/scripts fazem POST em
// http://127.0.0.1:47800/ingest  {title, detail?, source?, externalId?, url?, priority?}
// Só escuta em loopback.
function startIngest() {
  http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/ingest') { res.writeHead(404).end(); return; }
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const list = Array.isArray(payload) ? payload : [payload];
        const out = list.map((p) => store.upsert(p));
        save(); push();
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out));
      } catch (e) {
        res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: e.message }));
      }
    });
  }).listen(INGEST_PORT, '127.0.0.1');
}

// Arquivo de troca com o coletor na nuvem (ex.: pasta do OneDrive sincronizada).
// Formato: { generatedAt, okKinds: ['email',...], items: [...payloads do /ingest] }
function pollInbox() {
  const f = process.env.WORKSTACK_INBOX;
  if (!f) return;
  try {
    const m = fs.statSync(f).mtimeMs;
    if (m === lastInbox) return;
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    store.sync(Array.isArray(data.items) ? data.items : [], Array.isArray(data.okKinds) ? data.okKinds : []);
    lastInbox = m; save(); push();
  } catch (e) { /* arquivo ausente ou ainda sincronizando: tenta no próximo ciclo */ }
}

app.whenReady().then(() => {
  file = path.join(app.getPath('userData'), 'workstack.json');
  store = createStore(load());
  createWindow();
  startIngest();
  pollInbox();
  if (process.env.WORKSTACK_WATCH !== '0') setWatch(true);
  setInterval(pollInbox, 30000);

  ipcMain.handle('list', () => store.list());
  ipcMain.handle('add', (_e, t) => { store.upsert({ title: t }); save(); push(); });
  ipcMain.handle('priority', (_e, id, p) => { store.setPriority(id, p); save(); push(); });
  ipcMain.handle('done', (_e, id, d) => { store.setDone(id, d); save(); push(); });
  ipcMain.handle('remove', (_e, id) => { store.remove(id); save(); push(); });
  ipcMain.handle('open', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });
  ipcMain.handle('watch-toggle', () => setWatch(!watcher));
  ipcMain.handle('watch-state', () => !!watcher);
  ipcMain.handle('close', () => app.quit());

  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    win.isVisible() ? win.hide() : (win.show(), win.focus());
  });
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); if (watcher) watcher.stop(); });
app.on('window-all-closed', () => app.quit());
