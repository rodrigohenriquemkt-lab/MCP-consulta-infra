'use strict';
const { app, BrowserWindow, ipcMain, globalShortcut, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createStore } = require('./store');

const INGEST_PORT = Number(process.env.WORKSTACK_PORT || 47800);
let win, store, file;

const load = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } };
const save = () => fs.writeFileSync(file, JSON.stringify(store.snapshot(), null, 2));
const push = () => win && win.webContents.send('items', store.list());

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

app.whenReady().then(() => {
  file = path.join(app.getPath('userData'), 'workstack.json');
  store = createStore(load());
  createWindow();
  startIngest();

  ipcMain.handle('list', () => store.list());
  ipcMain.handle('add', (_e, t) => { store.upsert({ title: t }); save(); push(); });
  ipcMain.handle('priority', (_e, id, p) => { store.setPriority(id, p); save(); push(); });
  ipcMain.handle('done', (_e, id, d) => { store.setDone(id, d); save(); push(); });
  ipcMain.handle('remove', (_e, id) => { store.remove(id); save(); push(); });
  ipcMain.handle('open', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });
  ipcMain.handle('close', () => app.quit());

  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    win.isVisible() ? win.hide() : (win.show(), win.focus());
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
