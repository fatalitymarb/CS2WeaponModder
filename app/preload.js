const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('open-file'),
  loadDefault: () => ipcRenderer.invoke('load-default'),
  loadContent: (content, fileName) => ipcRenderer.invoke('load-content', content, fileName),
  saveAs: () => ipcRenderer.invoke('save-as'),
  updateData: (data) => ipcRenderer.invoke('update-data', data),
  addWeapon: (key, baseKey, resourceName) => ipcRenderer.invoke('add-weapon', key, baseKey, resourceName),
  deleteWeapon: (key) => ipcRenderer.invoke('delete-weapon', key),
  batchAdd: (weapons) => ipcRenderer.invoke('batch-add', weapons),
  parseModels: (content) => ipcRenderer.invoke('parse-models', content),
  getIcons: () => ipcRenderer.invoke('get-icons'),
  getIcon: (name) => ipcRenderer.invoke('get-icon', name)
});
