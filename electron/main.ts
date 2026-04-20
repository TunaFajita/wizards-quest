import { app, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const isDev = !app.isPackaged;

function startServer(): void {
  // In dev, the user runs `npm run server` separately via concurrently.
  // In production, we spawn the bundled server ourselves.
  if (isDev) return;

  const serverPath = path.join(process.resourcesPath, 'server', 'index.js');
  serverProcess = spawn(process.execPath, [serverPath], {
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'production' },
  });

  serverProcess.stdout?.on('data', (d: Buffer) => console.log(`[server] ${d}`));
  serverProcess.stderr?.on('data', (d: Buffer) => console.error(`[server] ${d}`));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'Wizards Quest',
    icon: path.join(__dirname, '../assets/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Dev → Vite dev server. Prod → built files.
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
