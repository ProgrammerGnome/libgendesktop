const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  fetchLibgen: (query) => ipcRenderer.invoke('fetch-libgen', query),
  getDownloadLink: (md5) => ipcRenderer.invoke('get-libgen-download-link', md5),
  startDownload: (md5) => ipcRenderer.send('start-download', md5),

  onDownloadStatus: (callback) => ipcRenderer.on('download-status', callback),
  onDownloadDone: (callback) => ipcRenderer.on('download-done', callback),
  onDownloadError: (callback) => ipcRenderer.on('download-error', callback),

  listDownloads: () => ipcRenderer.invoke('list-downloads-folder'),
});
