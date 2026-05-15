const { app, BrowserWindow, ipcMain, shell } = require('electron');
app.name = "Kehl Study";
const path = require('path');
const { spawn } = require('child_process');
const isDev = !app.isPackaged;
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const { spawnSync } = require('child_process');

let mainWindow;
let nextProcess;

// Configure paths
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'database.db');
const dbUrl = `file:${dbPath}`;
const downloadsPath = app.getPath('downloads');
const defaultInboxPath = path.join(downloadsPath, 'KehlStudy_Inbox');

// Database Setup Function
function setupDatabase() {
  if (isDev) return; // Dev uses local dev.db mostly
  
  console.log(`Ensuring database exists at: ${dbPath}`);
  
  // Use internal electron node to run prisma
  const prismaPath = path.join(app.getAppPath(), 'node_modules/prisma/build/index.js');
  
  // Push schema to DB (handles creation and migrations)
  spawnSync(process.execPath, [prismaPath, 'db', 'push', '--skip-generate'], {
    shell: true,
    env: { 
      ...process.env, 
      DATABASE_URL: dbUrl,
      ELECTRON_RUN_AS_NODE: '1'
    },
    stdio: 'inherit'
  });
}

// Ensure inbox exists
if (!fs.existsSync(defaultInboxPath)) {
  fs.mkdirSync(defaultInboxPath, { recursive: true });
}

// Set Environment Variables for Next.js
process.env.DATABASE_URL = dbUrl;
process.env.PDF_INBOX_DIR = defaultInboxPath;
process.env.NEXT_PRIVATE_STANDALONE = 'true';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Kehl Study",
    icon: path.join(__dirname, '../public/brand/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Start Next.js
  const startNext = () => {
    if (isDev) {
      console.log('Starting Next.js in Dev mode...');
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      nextProcess = spawn(npmCmd, ['run', 'dev'], {
        cwd: path.join(__dirname, '..'),
        shell: true,
        env: { ...process.env, PORT: '3000' }
      });
    } else {
      console.log('Starting Next.js in Production mode...');
      const serverPath = path.join(app.getAppPath(), '.next/standalone/server.js');
      
      // Use internal electron node to run server
      nextProcess = spawn(process.execPath, [serverPath], {
        cwd: path.join(app.getAppPath(), '.next/standalone'),
        env: { 
          ...process.env, 
          PORT: '3000',
          ELECTRON_RUN_AS_NODE: '1'
        }
      });
    }

    nextProcess.stdout.on('data', (data) => {
      console.log(`Next: ${data}`);
      if (data.toString().includes('Ready in') || data.toString().includes('started server on')) {
        mainWindow.loadURL('http://localhost:3000');
      }
    });

    nextProcess.stderr.on('data', (data) => {
      console.error(`Next Error: ${data}`);
    });
  };

  startNext();

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (nextProcess) nextProcess.kill();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Auto-updater logic
autoUpdater.on('checking-for-update', () => {
  mainWindow?.webContents.send('checking_updates');
});

autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('update_available', info);
});

autoUpdater.on('update-not-available', (info) => {
  mainWindow?.webContents.send('update_not_available', info);
});

autoUpdater.on('error', (err) => {
  mainWindow?.webContents.send('update_error', err.message);
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow?.webContents.send('download_progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('update_downloaded', info);
});

ipcMain.on('start-download', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

app.on('ready', () => {
  setupDatabase();
  createWindow();
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

process.on('exit', () => {
  if (nextProcess) nextProcess.kill();
});
