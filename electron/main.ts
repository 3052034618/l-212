import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    title: '数据要素接口验收客户端',
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 768,
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
      webSecurity: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }

  win.on('closed', () => {
    win = null
  })
}

const getDataDir = () => {
  const userDataPath = app.getPath('userData')
  const dataDir = path.join(userDataPath, 'acceptance-data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  return dataDir
}

ipcMain.handle('get-data-dir', () => {
  return getDataDir()
})

ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8')
    return { success: true, data }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
})

ipcMain.handle('write-file', async (_event, filePath: string, content: string) => {
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
})

ipcMain.handle('open-file-dialog', async (_event, options: any) => {
  const result = await dialog.showOpenDialog(win!, options)
  return result
})

ipcMain.handle('save-file-dialog', async (_event, options: any) => {
  const result = await dialog.showSaveDialog(win!, options)
  return result
})

ipcMain.handle('open-external', async (_event, url: string) => {
  shell.openExternal(url)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.whenReady().then(createWindow)

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
