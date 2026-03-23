const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { parseVdata, serializeVdata, HEADER_COMMENT } = require('./vdata-parser');

let mainWindow;
let currentData = null;
let headerComment = HEADER_COMMENT;

function getAppIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icon.ico');
  }
  return path.join(__dirname, 'build', 'icon.ico');
}

function getPanoramaDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'panorama', 'images', 'icons', 'equipment');
  }
  return path.join(__dirname, '..', 'panorama', 'images', 'icons', 'equipment');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'CS2WeaponModder',
    icon: getAppIconPath(),
    autoHideMenuBar: true,
    backgroundColor: '#0a0a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.cs2.weapon-modder');
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select a .vdata or .txt file',
    filters: [
      { name: 'VData Files', extensions: ['vdata', 'txt', 'cfg'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  try {
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');

    const firstLine = content.split('\n')[0].trim();
    if (firstLine.startsWith('<!--')) {
      headerComment = firstLine;
    }

    currentData = parseVdata(content);
    return { success: true, data: currentData, filePath: path.basename(filePath) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-default', () => {
  try {
    const defaultPath = path.join(__dirname, 'default-weapons.vdata');

    if (!fs.existsSync(defaultPath)) {
      return { success: false, error: 'Default weapons.vdata not found' };
    }

    const content = fs.readFileSync(defaultPath, 'utf-8');

    const firstLine = content.split('\n')[0].trim();
    if (firstLine.startsWith('<!--')) {
      headerComment = firstLine;
    }

    currentData = parseVdata(content);
    return { success: true, data: currentData, filePath: 'default-weapons.vdata' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('save-as', () => {
  if (!currentData) {
    return { success: false, error: 'No data to save' };
  }

  try {
    const result = dialog.showSaveDialogSync(mainWindow, {
      title: 'Save as .vdata',
      defaultPath: 'weapons.vdata',
      filters: [
        { name: 'VData Files', extensions: ['vdata'] }
      ]
    });

    if (!result) {
      return { success: false, canceled: true };
    }

    let savePath = result;
    if (!savePath.toLowerCase().endsWith('.vdata')) {
      savePath = savePath.replace(/\.[^.]+$/, '') + '.vdata';
    }

    const content = serializeVdata(currentData, headerComment);
    fs.writeFileSync(savePath, content, 'utf-8');
    return { success: true, filePath: savePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-data', (_event, data) => {
  currentData = data;
  return { success: true };
});

ipcMain.handle('add-weapon', (_event, key, baseKey, resourceName) => {
  if (!currentData) return { success: false, error: 'No file loaded' };
  if (!key || !baseKey) return { success: false, error: 'Missing key or baseKey' };
  if (currentData[key]) return { success: false, error: 'Weapon already exists' };

  const base = currentData[baseKey];
  if (!base) return { success: false, error: 'Base weapon not found' };

  const newWeapon = JSON.parse(JSON.stringify(base));
  if (resourceName) {
    newWeapon.m_szWorldModel = `resource_name:"${resourceName}"`;
  }

  currentData[key] = newWeapon;
  if (currentData.__orderedKeys) {
    currentData.__orderedKeys.push(key);
  }

  return { success: true, data: newWeapon };
});

ipcMain.handle('delete-weapon', (_event, key) => {
  if (!currentData) return { success: false, error: 'No file loaded' };
  if (!currentData[key]) return { success: false, error: 'Weapon not found' };

  delete currentData[key];
  if (currentData.__orderedKeys) {
    currentData.__orderedKeys = currentData.__orderedKeys.filter(k => k !== key);
  }

  return { success: true };
});

ipcMain.handle('batch-add', (_event, weapons) => {
  if (!currentData) return { success: false, error: 'No file loaded' };

  const results = [];
  for (const w of weapons) {
    const { key, baseKey, modelPath, name } = w;
    if (!key || !baseKey) {
      results.push({ key, success: false, error: 'Missing key or baseKey' });
      continue;
    }
    if (currentData[key]) {
      results.push({ key, success: false, error: 'Already exists' });
      continue;
    }
    const base = currentData[baseKey];
    if (!base) {
      results.push({ key, success: false, error: 'Base not found' });
      continue;
    }
    const newWeapon = JSON.parse(JSON.stringify(base));
    if (modelPath) newWeapon.m_szWorldModel = `resource_name:"${modelPath}"`;
    if (name) newWeapon.m_szName = name;

    currentData[key] = newWeapon;
    if (currentData.__orderedKeys) currentData.__orderedKeys.push(key);
    results.push({ key, success: true });
  }

  return { results };
});

ipcMain.handle('parse-models', (_event, content) => {
  const models = content.split('\n')
    .map(l => l.trim())
    .filter(l => l.endsWith('.vmdl'));
  return { models };
});

ipcMain.handle('get-icon', (_event, name) => {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '');
  const panoramaDir = getPanoramaDir();
  const iconPath = path.join(panoramaDir, `${safeName}.svg`);
  try {
    if (fs.existsSync(iconPath)) {
      const content = fs.readFileSync(iconPath, 'utf-8');
      return { success: true, svg: content };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
});
