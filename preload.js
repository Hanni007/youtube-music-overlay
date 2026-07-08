const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  onSongUpdate: (callback) => ipcRenderer.on('song-update', callback),
  onConnectionStatus: (callback) => ipcRenderer.on('connection-status', callback),
});
