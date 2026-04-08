const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('classroomCodeNamesHost', {
  getStatus: () => ipcRenderer.invoke('host:get-status'),
  openStart: () => ipcRenderer.invoke('host:open-start'),
  restartServer: () => ipcRenderer.invoke('host:restart-server'),
  onStatus: (listener) => {
    const wrappedListener = (_event, status) => {
      listener(status);
    };

    ipcRenderer.on('host:status', wrappedListener);

    return () => {
      ipcRenderer.removeListener('host:status', wrappedListener);
    };
  }
});
