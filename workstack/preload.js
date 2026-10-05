'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ws', {
  list: () => ipcRenderer.invoke('list'),
  add: (t) => ipcRenderer.invoke('add', t),
  priority: (id, p) => ipcRenderer.invoke('priority', id, p),
  done: (id, d) => ipcRenderer.invoke('done', id, d),
  remove: (id) => ipcRenderer.invoke('remove', id),
  open: (u) => ipcRenderer.invoke('open', u),
  close: () => ipcRenderer.invoke('close'),
  onItems: (cb) => ipcRenderer.on('items', (_e, items) => cb(items)),
});
