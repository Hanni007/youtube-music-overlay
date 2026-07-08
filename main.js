const { app, BrowserWindow, Tray, Menu, globalShortcut } = require('electron');
const path = require('path');

let tray = null;
let overlayWin = null;
let isOverlayVisible = true;
let ws = null;
let reconnectTimer = null;

function createOverlay() {
  overlayWin = new BrowserWindow({
    width: 600, height: 130, x: 50, y: 50,
    transparent: true, frame: false, alwaysOnTop: true,
    skipTaskbar: true, focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  overlayWin.loadFile('index.html');
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
}

// 通过 WebSocket 连接 Pear Desktop 的 Companion API
function connectWebSocket() {
  try {
    ws = new (require('ws'))('ws://localhost:9863/companion');
    
    ws.on('open', () => {
      console.log('✅ 已连接到 Pear Desktop');
      if (overlayWin && !overlayWin.isDestroyed()) {
        overlayWin.webContents.send('connection-status', '已连接 🟢');
      }
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        // 处理歌曲更新
        if (msg.payload && msg.payload.track) {
          const track = msg.payload.track;
          const timeline = msg.payload.timeline;
          const songData = {
            title: track.title || '',
            artist: track.artist || '',
            thumbnail: track.thumbnail || '',
            progress: timeline?.positionMs || 0,
            duration: timeline?.durationMs || 0,
            isPaused: msg.payload.playbackStatus !== 'playing'
          };
          if (overlayWin && !overlayWin.isDestroyed()) {
            overlayWin.webContents.send('song-update', songData);
          }
        }
      } catch (e) {}
    });

    ws.on('error', (err) => {
      console.log('⚠️ WebSocket 连接失败，等待重连...');
      if (overlayWin && !overlayWin.isDestroyed()) {
        overlayWin.webContents.send('connection-status', '未连接 ⚠️');
      }
      reconnectLater();
    });

    ws.on('close', () => {
      console.log('🔌 连接已断开');
      reconnectLater();
    });
  } catch (e) {
    reconnectLater();
  }
}

function reconnectLater() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    connectWebSocket();
  }, 3000);
}

// 控制播放（通过HTTP API）
function sendMediaControl(action) {
  const url = `http://localhost:9863/api/v1/control/${action}`;
  fetch(url, { method: 'POST', mode: 'no-cors' }).catch(() => {});
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.ico'));
  const contextMenu = Menu.buildFromTemplate([
    { label: '👁 显示/隐藏', click: () => { 
        isOverlayVisible = !isOverlayVisible; 
        if (overlayWin && !overlayWin.isDestroyed()) {
          isOverlayVisible ? overlayWin.show() : overlayWin.hide();
        }
      } 
    },
    { type: 'separator' },
    { label: '⏮ 上一首', click: () => sendMediaControl('previous') },
    { label: '⏸ 播放/暂停', click: () => sendMediaControl('playpause') },
    { label: '⏭ 下一首', click: () => sendMediaControl('next') },
    { type: 'separator' },
    { label: '❌ 退出', click: () => { app.quit(); } }
  ]);
  tray.setToolTip('YouTube Music 覆盖层');
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createOverlay();
  createTray();
  setTimeout(connectWebSocket, 1000);
  globalShortcut.register('P', () => { if (tray) tray.popUpContextMenu(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => { 
  globalShortcut.unregisterAll();
  if (ws) ws.close();
  if (reconnectTimer) clearTimeout(reconnectTimer);
});
