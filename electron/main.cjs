const { app, BrowserWindow, ipcMain, shell, dialog, Menu, Tray } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
let tray = null;
const PORT = process.env.PORT || 3000;
const SERVER_URL = `http://localhost:${PORT}`;

// Single instance lock (prevents multiple database lock collisions)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function checkServerReady(url, maxAttempts = 30, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      http.get(url + '/api/health', (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else if (attempts >= maxAttempts) {
          reject(new Error('Servidor não respondeu a tempo'));
        } else {
          setTimeout(check, interval);
        }
      }).on('error', () => {
        if (attempts >= maxAttempts) {
          // Resolve anyway so the window can show retry/loading UI
          resolve(false);
        } else {
          setTimeout(check, interval);
        }
      });
    };
    check();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 640,
    title: 'TechCell - PDV & Assistência Técnica',
    backgroundColor: '#f5f5f7', // light Apple theme
    frame: true, // Native Windows Title Bar & controls
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      spellcheck: false
    }
  });

  // Remove default top menu for a modern clean look
  mainWindow.setMenuBarVisibility(false);

  // Wait for the backend Express server to be reachable
  try {
    await checkServerReady(SERVER_URL);
  } catch (err) {
    console.warn('Servidor local pode estar demorando a subir...', err);
  }

  // Load app from local express server
  mainWindow.loadURL(SERVER_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle external links (like WhatsApp wa.me links) in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Keyboard shortcuts (F11 Fullscreen, F12 DevTools in dev mode)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
    if (input.key === 'F12' && input.type === 'keyDown' && process.env.NODE_ENV !== 'production') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (input.key === 'F5' && input.type === 'keyDown') {
      mainWindow.reload();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for Window Controls & Thermal Printing
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return mainWindow.isMaximized();
  }
  return false;
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('window:toggleFullScreen', () => {
  if (mainWindow) {
    const isFull = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(isFull);
    return isFull;
  }
  return false;
});

ipcMain.handle('shell:openExternal', async (event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:') || url.startsWith('tel:'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

// Silent or Direct Thermal Receipt Printing Handler
ipcMain.handle('print:thermalReceipt', async (event, options = {}) => {
  if (!mainWindow) return { success: false, error: 'Janela não encontrada' };

  try {
    const defaultOptions = {
      silent: options.silent || false,
      printBackground: true,
      deviceName: options.deviceName || '',
      pageSize: options.width === '58mm' ? { width: 58000, height: 200000 } : { width: 80000, height: 300000 },
      margins: { marginType: 'none' }
    };

    return new Promise((resolve) => {
      mainWindow.webContents.print(defaultOptions, (success, failureReason) => {
        if (!success) {
          resolve({ success: false, error: failureReason });
        } else {
          resolve({ success: true });
        }
      });
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Native Save Dialog for SQLite Backup export
ipcMain.handle('dialog:saveBackup', async (event, defaultName) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar Cópia de Segurança SQLite',
    defaultPath: defaultName || `TechCell_Backup_${new Date().toISOString().split('T')[0]}.sqlite`,
    filters: [
      { name: 'Banco de Dados SQLite (*.sqlite, *.db)', extensions: ['sqlite', 'db'] },
      { name: 'Todos os Arquivos', extensions: ['*'] }
    ]
  });
  return result;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
