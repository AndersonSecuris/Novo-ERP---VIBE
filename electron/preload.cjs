const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  
  // Window control actions
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  toggleFullScreen: () => ipcRenderer.invoke('window:toggleFullScreen'),

  // External web link opening (WhatsApp, docs, maps)
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Thermal direct printing integration
  printThermalReceipt: (options) => ipcRenderer.invoke('print:thermalReceipt', options),

  // Native File dialogs
  saveBackupDialog: (defaultName) => ipcRenderer.invoke('dialog:saveBackup', defaultName),
});
