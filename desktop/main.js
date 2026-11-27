const { app, BrowserWindow, shell } = require('electron')
const fs = require('fs')
const path = require('path')

function getAppUrl() {
  if (process.env.APP_URL) return process.env.APP_URL
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed.appUrl) return parsed.appUrl
  } catch {
    // Fallback below
  }
  return 'https://upvc-software.vercel.app'
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    title: 'LS Interiors',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.loadURL(getAppUrl())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
