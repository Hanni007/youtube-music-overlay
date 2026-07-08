const { app, BrowserWindow, Tray, Menu, globalShortcut } = require('electron');
const path = require('path');
const { getActiveSessions, onSessionsChanged, sendControl, ControlTypes } = require('windows-media-sessions');

let tray = null;
let overlayWin = null;
let isOverlayVisible = true;
let currentSong = { title: '', artist: '', thumbnail: '', progress: 0, duration: 0, isPaused: true };

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

function sendMediaControl(action) {
  try {
    if (action === 'playpause') sendControl(ControlTypes.PLAY_PAUSE);
    else if (action === 'next') sendControl(ControlTypes.NEXT);
    else if (action === 'previous') sendControl(ControlTypes.PREVIOUS);
  } catch (e) { /* 忽略错误 */ }
}

function startMediaListener() {
  async function updateSong() {
    try {
      const sessions = await getActiveSessions();
      const ytSession = sessions.find(s => s.sourceAppDisplayName && (s.sourceAppDisplayName.includes('YouTube') || s.sourceAppDisplayName.includes('Pear')));
      if (ytSession) {
        currentSong.title = ytSession.title || '';
        currentSong.artist = ytSession.artist || '';
        currentSong.thumbnail = ytSession.thumbnail || '';
        currentSong.progress = ytSession.timeline?.positionMs || 0;
        currentSong.duration = ytSession.timeline?.durationMs || 0;
        currentSong.isPaused = ytSession.playbackStatus !== 'playing';
        if (overlayWin && !overlayWin.isDestroyed()) {
          overlayWin.webContents.send('song-update', currentSong);
        }
      }
    } catch (e) {}
  }
  updateSong();
  setInterval(updateSong, 1500);
  onSessionsChanged((sessions) => {
    const ytSession = sessions.find(s => s.sourceAppDisplayName && (s.sourceAppDisplayName.includes('YouTube') || s.sourceAppDisplayName.includes('Pear')));
    if (ytSession) {
      currentSong.title = ytSession.title || '';
      currentSong.artist = ytSession.artist || '';
      currentSong.thumbnail = ytSession.thumbnail || '';
      currentSong.progress = ytSession.timeline?.positionMs || 0;
      currentSong.duration = ytSession.timeline?.durationMs || 0;
      currentSong.isPaused = ytSession.playbackStatus !== 'playing';
      if (overlayWin && !overlayWin.isDestroyed()) {
        overlayWin.webContents.send('song-update', currentSong);
      }
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.ico');
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: '👁 显示/隐藏', click: () => { isOverlayVisible = !isOverlayVisible; overlayWin[isOverlayVisible ? 'show' : 'hide'](); } },
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
  startMediaListener();
  globalShortcut.register('P', () => { if (tray) tray.popUpContextMenu(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); });
