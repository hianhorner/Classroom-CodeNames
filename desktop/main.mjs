import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const desktopDirectory = path.dirname(currentFilePath);
const projectRoot = path.resolve(desktopDirectory, '..');
const hostHtmlPath = path.join(desktopDirectory, 'host.html');
const iconSvgPath = path.join(desktopDirectory, 'assets', 'icon.svg');
const clientDistPath = path.join(projectRoot, 'client', 'dist');
const serverEntryPath = path.join(projectRoot, 'server', 'dist', 'index.js');
const previewPort = Number(process.env.PORT ?? 4173);

let hostWindow = null;
let serverHandle = null;
let cachedServerModulePromise = null;
let runtimePaths = null;
let statusState = {
  phase: 'idle',
  message: 'Preparing Classroom CodeNames.',
  localUrl: `http://127.0.0.1:${previewPort}`,
  lanUrl: '',
  dataPath: '',
  logsPath: '',
  error: null
};

function getPublicStatus() {
  return {
    phase: statusState.phase,
    message: statusState.message,
    lanUrl: statusState.lanUrl,
    error: statusState.error
  };
}

function getTimestamp() {
  return new Date().toISOString();
}

async function appendLog(message) {
  if (!runtimePaths?.logFilePath) {
    return;
  }

  await fs.appendFile(runtimePaths.logFilePath, `[${getTimestamp()}] ${message}\n`, 'utf8');
}

async function persistStatus() {
  if (!runtimePaths?.stateFilePath) {
    return;
  }

  await fs.writeFile(runtimePaths.stateFilePath, JSON.stringify(statusState, null, 2), 'utf8');
}

function isPrivateIpv4(address) {
  return (
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}

function getLanIpv4Address() {
  const networkInterfaces = os.networkInterfaces();
  const fallbackAddresses = [];

  for (const entries of Object.values(networkInterfaces)) {
    for (const entry of entries ?? []) {
      if (!entry || entry.family !== 'IPv4' || entry.internal) {
        continue;
      }

      if (isPrivateIpv4(entry.address)) {
        return entry.address;
      }

      fallbackAddresses.push(entry.address);
    }
  }

  return fallbackAddresses[0] ?? '127.0.0.1';
}

function getLanUrl(port) {
  return `http://${getLanIpv4Address()}:${port}`;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForHealth(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {}

    await wait(1000);
  }

  throw new Error(`Server did not become ready at ${url}.`);
}

function getAppIcon() {
  return nativeImage.createFromPath(iconSvgPath);
}

function broadcastStatus() {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('host:status', getPublicStatus());
  });
}

function setStatus(nextStatus) {
  statusState = {
    ...statusState,
    ...nextStatus
  };
  broadcastStatus();
  void persistStatus();
  void appendLog(`STATUS ${statusState.phase}: ${statusState.message}${statusState.error ? ` | ${statusState.error}` : ''}`);
}

function createHostWindow() {
  hostWindow = new BrowserWindow({
    width: 520,
    height: 700,
    minWidth: 420,
    minHeight: 620,
    title: 'Classroom CodeNames',
    icon: getAppIcon(),
    autoHideMenuBar: true,
    backgroundColor: '#d8d1c6',
    webPreferences: {
      preload: path.join(desktopDirectory, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  hostWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  hostWindow.webContents.on('will-navigate', (event, targetUrl) => {
    const currentUrl = hostWindow?.webContents.getURL() ?? '';

    if (targetUrl !== currentUrl) {
      event.preventDefault();
    }
  });

  hostWindow.on('closed', () => {
    hostWindow = null;
  });

  hostWindow.loadFile(hostHtmlPath);
}

async function ensureRuntimePaths() {
  const userDataPath = app.getPath('userData');
  const dataPath = path.join(userDataPath, 'data');
  const logsPath = path.join(userDataPath, 'logs');
  const runtimePath = path.join(userDataPath, 'runtime');

  await fs.mkdir(dataPath, { recursive: true });
  await fs.mkdir(logsPath, { recursive: true });
  await fs.mkdir(runtimePath, { recursive: true });

  return {
    userDataPath,
    dataPath,
    logsPath,
    runtimePath,
    databasePath: path.join(dataPath, 'classroom-codenames.sqlite'),
    logFilePath: path.join(logsPath, 'host.log'),
    stateFilePath: path.join(runtimePath, 'host-state.json'),
    pidFilePath: path.join(runtimePath, 'host.pid')
  };
}

async function loadServerModule() {
  if (!cachedServerModulePromise) {
    cachedServerModulePromise = import(pathToFileURL(serverEntryPath).href);
  }

  return cachedServerModulePromise;
}

async function stopEmbeddedServer() {
  if (!serverHandle) {
    return;
  }

  const activeHandle = serverHandle;
  serverHandle = null;
  await activeHandle.close();
}

async function startEmbeddedServer() {
  runtimePaths = await ensureRuntimePaths();
  const localUrl = `http://127.0.0.1:${previewPort}`;
  const lanUrl = getLanUrl(previewPort);

  await fs.writeFile(runtimePaths.pidFilePath, String(process.pid), 'utf8');

  setStatus({
    phase: 'starting',
    message: 'Starting the local classroom server...',
    localUrl,
    lanUrl,
    dataPath: runtimePaths.dataPath,
    logsPath: runtimePaths.logsPath,
    error: null
  });

  await stopEmbeddedServer();

  process.env.PORT = String(previewPort);
  process.env.HOST = '0.0.0.0';
  process.env.SERVE_CLIENT = 'true';
  process.env.APP_BASE_URL = lanUrl;
  process.env.DATABASE_PATH = runtimePaths.databasePath;
  process.env.CLIENT_DIST_PATH = clientDistPath;

  await appendLog(`Loading bundled server module from ${serverEntryPath}`);
  const serverModule = await loadServerModule();
  await appendLog('Starting bundled server instance.');
  serverHandle = await serverModule.startServer();
  await appendLog(`Waiting for health at ${localUrl}/api/health`);
  await waitForHealth(`${localUrl}/api/health`);
  await appendLog('Embedded server is healthy.');

  setStatus({
    phase: 'ready',
    message: 'Ready on this network.',
    localUrl,
    lanUrl,
    dataPath: runtimePaths.dataPath,
    logsPath: runtimePaths.logsPath,
    error: null
  });
  await appendLog('Server is ready. Waiting for Start action.');
}

async function restartEmbeddedServer() {
  try {
    await startEmbeddedServer();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start Classroom CodeNames.';
    void appendLog(`ERROR ${message}`);
    setStatus({
      phase: 'error',
      message: 'The local server could not be started.',
      error: message
    });
    if (hostWindow) {
      dialog.showErrorBox('Classroom CodeNames', message);
    }
  }
}

ipcMain.handle('host:get-status', async () => getPublicStatus());
ipcMain.handle('host:open-start', async () => {
  if (!statusState.lanUrl) {
    return '';
  }

  await shell.openExternal(statusState.lanUrl);
  return statusState.lanUrl;
});
ipcMain.handle('host:restart-server', async () => {
  await restartEmbeddedServer();
});

app.setName('Classroom CodeNames');

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (hostWindow) {
      if (hostWindow.isMinimized()) {
        hostWindow.restore();
      }
      hostWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    createHostWindow();
    await restartEmbeddedServer();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createHostWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('before-quit', async () => {
    await stopEmbeddedServer();
    if (runtimePaths?.pidFilePath) {
      await fs.rm(runtimePaths.pidFilePath, { force: true });
    }
  });
}
