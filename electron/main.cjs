const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('path');
const http = require('http');
const net = require('net');
const fs = require('fs');

let mainWindow = null;
let serverProcess = null;
let activeServerUrl = null;

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

// Find a free TCP port dynamically starting from startingPort
function getAvailablePort(startingPort = 3000) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startingPort, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : startingPort;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      resolve(getAvailablePort(startingPort + 1));
    });
  });
}

// Fast health-check probe for the local Express / SQLite server
function checkServerReady(url, maxAttempts = 60, interval = 200) {
  return new Promise((resolve) => {
    let attempts = 0;
    const probe = () => {
      attempts++;
      const req = http.get(url + '/api/health', { timeout: 1500 }, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else if (attempts >= maxAttempts) {
          resolve(false);
        } else {
          setTimeout(probe, interval);
        }
      });

      req.on('error', () => {
        if (attempts >= maxAttempts) {
          resolve(false);
        } else {
          setTimeout(probe, interval);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (attempts >= maxAttempts) {
          resolve(false);
        } else {
          setTimeout(probe, interval);
        }
      });
    };
    probe();
  });
}

// Start the embedded Express & SQLite server in production or when dev server is absent
async function startEmbeddedBackend(port) {
  const userDataPath = app.getPath('userData');
  process.env.USER_DATA_PATH = userDataPath;
  process.env.PORT = String(port);
  process.env.NODE_ENV = 'production';
  process.env.AUTO_START = 'false';

  const candidateServerPaths = [
    path.join(__dirname, '../dist/server.cjs'),
    path.join(__dirname, 'server.cjs'),
    path.join(process.resourcesPath, 'app/dist/server.cjs'),
    path.join(process.resourcesPath, 'app.asar/dist/server.cjs'),
    path.join(app.getAppPath(), 'dist/server.cjs'),
  ];

  let serverModule = null;
  let usedPath = null;

  for (const candidate of candidateServerPaths) {
    if (fs.existsSync(candidate)) {
      try {
        usedPath = candidate;
        serverModule = require(candidate);
        break;
      } catch (err) {
        console.error(`Erro ao carregar módulo do servidor em ${candidate}:`, err);
      }
    }
  }

  if (serverModule) {
    console.log(`🚀 Servidor backend inicializado a partir de: ${usedPath}`);
    if (typeof serverModule.startServer === 'function') {
      serverProcess = await serverModule.startServer(port);
    } else if (typeof serverModule.default === 'function') {
      serverProcess = await serverModule.default(port);
    }
  } else {
    console.warn('⚠️ Nenhum arquivo server.cjs encontrado nos caminhos padrão.');
  }

  return `http://127.0.0.1:${port}`;
}

function showRecoveryScreen(win, details) {
  const html = `<!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <title>TechCell PDV - Conexão Local</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background: #f1f5f9;
        color: #0f172a;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 24px;
      }
      .card {
        background: #ffffff;
        max-width: 520px;
        width: 100%;
        padding: 32px;
        border-radius: 16px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.06);
        text-align: center;
        border: 1px solid #e2e8f0;
      }
      .icon {
        font-size: 40px;
        margin-bottom: 16px;
      }
      h1 { font-size: 20px; font-weight: 700; margin: 0 0 10px; color: #0f172a; }
      p { font-size: 14px; color: #64748b; line-height: 1.5; margin: 0 0 20px; }
      .details {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #475569;
        padding: 12px;
        border-radius: 8px;
        font-family: Consolas, monospace;
        font-size: 12px;
        text-align: left;
        margin-bottom: 24px;
        word-break: break-all;
      }
      .btn {
        background: #2563eb;
        color: #ffffff;
        border: none;
        padding: 11px 22px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        display: inline-block;
        margin: 4px;
        text-decoration: none;
      }
      .btn:hover { background: #1d4ed8; }
      .btn-secondary {
        background: #e2e8f0;
        color: #334155;
      }
      .btn-secondary:hover { background: #cbd5e1; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">⚡</div>
      <h1>TechCell PDV & Assistência</h1>
      <p>A inicialização do banco de dados ou do servidor local levou mais tempo que o esperado.</p>
      <div class="details">${details || 'Tentando restabelecer conexão com o serviço local...'}</div>
      <button class="btn" onclick="location.reload()">Recarregar Aplicativo</button>
      <button class="btn btn-secondary" onclick="window.history.back()">Voltar</button>
    </div>
  </body>
  </html>`;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 640,
    title: 'TechCell - PDV & Assistência Técnica',
    backgroundColor: '#f8fafc',
    frame: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      spellcheck: false
    }
  });

  // Remove default top menu for clean native look
  mainWindow.setMenuBarVisibility(false);

  // Determine server URL:
  // In development, if port 3000 is active with /api/health, connect to it.
  // Otherwise, start embedded backend server on a guaranteed free port.
  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  let targetUrl = `http://localhost:${process.env.PORT || 3000}`;
  let serverReady = false;

  if (isDev) {
    serverReady = await checkServerReady(targetUrl, 5, 200);
  }

  if (!serverReady) {
    const chosenPort = await getAvailablePort(3000);
    targetUrl = await startEmbeddedBackend(chosenPort);
    serverReady = await checkServerReady(targetUrl, 50, 200);
  }

  activeServerUrl = targetUrl;

  if (serverReady) {
    mainWindow.loadURL(targetUrl);
  } else {
    // If server takes abnormally long, show recovery screen rather than white window
    showRecoveryScreen(mainWindow, `Não foi possível conectar ao servidor local em ${targetUrl}`);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Fallback if ready-to-show is delayed
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 3500);

  // Protect against blank white screen on unexpected load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Falha ao carregar URL (${errorCode}): ${errorDescription} em ${validatedURL}`);
    if (errorCode !== -3) { // -3 is ABORTED (e.g. redirected or reload requested)
      showRecoveryScreen(mainWindow, `Erro de rede (${errorCode}): ${errorDescription}`);
    }
  });

  // Handle external links (WhatsApp wa.me, maps, etc.) in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Keyboard shortcuts (F11 Fullscreen, F12 DevTools, F5 Reload)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
    if ((input.key === 'F12' || (input.key === 'I' && input.control && input.shift)) && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (input.key === 'F5' && input.type === 'keyDown') {
      if (activeServerUrl) {
        mainWindow.loadURL(activeServerUrl);
      } else {
        mainWindow.reload();
      }
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for Window Controls
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
  if (serverProcess && typeof serverProcess.close === 'function') {
    try {
      serverProcess.close();
    } catch {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
