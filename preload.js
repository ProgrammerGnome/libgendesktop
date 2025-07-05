const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('libgenAPI', {
  fetchBooks: (query) => ipcRenderer.invoke('fetch-libgen', query)
});

