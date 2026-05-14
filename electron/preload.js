const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => {
    let validChannels = ['toMain', 'check-updates', 'start-download', 'quit-and-install'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    let validChannels = [
      'fromMain', 
      'update_available', 
      'update_not_available', 
      'download_progress', 
      'update_downloaded',
      'update_error',
      'checking_updates'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});
