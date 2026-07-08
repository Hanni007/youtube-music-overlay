const { ipcRenderer } = require('electron');

let rainbowInterval = null;
let songData = null;

ipcRenderer.on('song-update', (event, data) => {
  songData = data;
  updateDisplay();
});

ipcRenderer.on('connection-status', (event, status) => {
  document.getElementById('subtitle-text').textContent = status;
});

function updateDisplay() {
  const container = document.getElementById('container');
  if (!songData || !songData.title) { 
    container.style.display = 'none'; 
    return; 
  }
  container.style.display = 'flex';
  document.getElementById('album-art').src = songData.thumbnail || '';
  document.getElementById('song-title').textContent = songData.title;
  document.getElementById('song-artist').textContent = songData.artist || '未知艺术家';
  const pct = songData.duration > 0 ? (songData.progress / songData.duration) * 100 : 0;
  document.getElementById('progress').style.width = Math.min(pct, 100) + '%';
  document.getElementById('status-dot').style.background = songData.isPaused ? '#ff6b6b' : '#51cf66';
}

function startRainbow() {
  if (rainbowInterval) clearInterval(rainbowInterval);
  let hue = 0;
  rainbowInterval = setInterval(() => {
    hue = (hue + 1) % 360;
    const color = `hsl(${hue}, 100%, 65%)`;
    document.getElementById('song-title').style.color = color;
    document.getElementById('song-title').style.textShadow = `0 0 30px ${color}80`;
  }, 30);
}
setTimeout(startRainbow, 100);
