// FlowTate — main process: lifecycle, tray, pill window, hotkey, pipeline.
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const Store = require('electron-store');
const { transcribeFile } = require('./stt/whisper-local');
const { polish } = require('./polish');
const { injectText } = require('./inject');

const store = new Store({ defaults: { hotkey: 'CommandOrControl+Shift+Space' } });

let pill = null;
let tray = null;
let recording = false;
let audioChunks = [];

function createPill() {
  pill = new BrowserWindow({
    width: 260, height: 60,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, movable: false, minimizable: false, maximizable: false,
    show: false, focusable: false, skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  pill.setIgnoreMouseEvents(true, { forward: true });
  pill.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pill.loadFile(path.join(__dirname, 'renderer', 'pill.html'));
}

function setPillState(state, text = '') {
  if (pill && !pill.isDestroyed()) pill.webContents.send('pill-state', { state, text });
  if (tray) tray.setTitle(state === 'listening' ? '● REC' : 'FlowTate');
}

async function toggleDictation() {
  if (!pill || pill.isDestroyed()) return;
  if (recording) await stopDictation();
  else startDictation();
}

function startDictation() {
  recording = true;
  audioChunks = [];
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  pill.setPosition(
    Math.min(cursor.x, display.bounds.x + display.workAreaSize.width - 280),
    cursor.y + 28
  );
  pill.showInactive();
  setPillState('listening');
  pill.webContents.send('pill-record-start');
}

async function stopDictation() {
  recording = false;
  // Renderer stops MediaRecorder, flushes chunks, then invokes 'recording-flushed'.
  pill.webContents.send('pill-record-stop');
}

ipcMain.on('audio-chunk', (_event, buf) => {
  audioChunks.push(Buffer.from(buf));
});

ipcMain.handle('recording-flushed', async () => {
  setPillState('processing', 'Transcribing…');
  const tmpWebm = path.join(os.tmpdir(), `flowtate-${Date.now()}.webm`);
  try {
    fs.writeFileSync(tmpWebm, Buffer.concat(audioChunks));
    const wav = await toWav16k(tmpWebm);
    const rawText = await transcribeFile(wav);
    fs.rm(wav, { force: true }, () => {});
    const finalText = await polish(rawText);
    if (finalText.trim()) {
      await injectText(finalText);
      setPillState('done', finalText.slice(0, 44));
    } else {
      setPillState('done', '(no speech detected)');
    }
  } catch (err) {
    setPillState('error', String((err && err.message) || err).slice(0, 64));
  } finally {
    fs.rm(tmpWebm, { force: true }, () => {});
    setTimeout(() => { if (pill && !pill.isDestroyed()) pill.hide(); }, 1500);
  }
});

function toWav16k(inputPath) {
  const out = inputPath.replace(/\.webm$/, '.wav');
  return new Promise((resolve, reject) => {
    execFile('ffmpeg',
      ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', out],
      (err, _stdout, stderr) => err
        ? reject(new Error('ffmpeg: ' + String(stderr).slice(-200)))
        : resolve(out));
  });
}

function registerHotkey() {
  globalShortcut.unregisterAll();
  const hotkey = store.get('hotkey');
  const ok = globalShortcut.register(hotkey, toggleDictation);
  console.log(`[main] hotkey "${hotkey}": ${ok ? 'registered' : 'FAILED'}`);
}

app.whenReady().then(() => {
  createPill();
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle('FlowTate');
  tray.setToolTip('FlowTate — voice dictation');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Toggle dictation', click: toggleDictation },
    { type: 'separator' },
    { label: `Hotkey: ${store.get('hotkey')}`, enabled: false },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
  registerHotkey();
  console.log('[main] ready');
});

app.on('window-all-closed', (e) => e.preventDefault());
app.on('will-quit', () => globalShortcut.unregisterAll());
