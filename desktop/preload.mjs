import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('classroomCodeNamesHost', {
  getStatus: () => ipcRenderer.invoke('host:get-status'),
  openTeacherWindow: () => ipcRenderer.invoke('host:open-teacher-window'),
  openBrowser: () => ipcRenderer.invoke('host:open-browser'),
  copyLanUrl: () => ipcRenderer.invoke('host:copy-lan-url'),
  restartServer: () => ipcRenderer.invoke('host:restart-server'),
  openDataFolder: () => ipcRenderer.invoke('host:open-data-folder'),
  openLogsFolder: () => ipcRenderer.invoke('host:open-logs-folder'),
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
