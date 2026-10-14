// FlowTate — main process: lifecycle, tray, pill window, hotkey, pipeline.
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Store = require('electron-store');
const { toWav16k } = require('./audio');
const { transcribeFile, ensureEngine } = require('./stt/engine');
const { polish } = require('./polish');
const { injectText } = require('./inject');

const store = new Store({ defaults: { hotkey: 'CommandOrControl+Shift+Space' } });

let pill = null;
let tray = null;
let hotkeyWin = null;
let recording = false;
let audioChunks = [];
let engineReady = false;

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
  if (!engineReady) {
    pill.showInactive();
    setPillState('error', 'Speech engine still loading…');
    setTimeout(() => { if (pill && !pill.isDestroyed()) pill.hide(); }, 1500);
    return;
  }
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

function registerHotkey() {
  globalShortcut.unregisterAll();
  const hotkey = store.get('hotkey');
  const ok = globalShortcut.register(hotkey, toggleDictation);
  console.log(`[main] hotkey "${hotkey}": ${ok ? 'registered' : 'FAILED'}`);
  return ok;
}

function buildTrayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Toggle dictation', click: toggleDictation },
    { type: 'separator' },
    { label: `Hotkey: ${store.get('hotkey')}`, enabled: false },
    { label: 'Change hotkey…', click: openHotkeyWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
}

function openHotkeyWindow() {
  if (hotkeyWin && !hotkeyWin.isDestroyed()) { hotkeyWin.focus(); return; }
  hotkeyWin = new BrowserWindow({
    width: 400, height: 220,
    resizable: false, minimizable: false, maximizable: false,
    alwaysOnTop: true, title: 'Change hotkey',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  hotkeyWin.setMenu(null);
  hotkeyWin.loadFile(path.join(__dirname, 'hotkey.html'));
  hotkeyWin.on('closed', () => { hotkeyWin = null; });
}

// Renderer captured a key combo; try it live. Restores the old hotkey on failure.
ipcMain.handle('set-hotkey', (_event, accel) => {
  const prev = store.get('hotkey');
  globalShortcut.unregisterAll();
  const ok = globalShortcut.register(accel, toggleDictation);
  if (ok) {
    store.set('hotkey', accel);
    console.log(`[main] hotkey changed to "${accel}"`);
  } else {
    globalShortcut.register(prev, toggleDictation);
    console.log(`[main] hotkey "${accel}" rejected, kept "${prev}"`);
  }
  buildTrayMenu();
  return { ok, hotkey: store.get('hotkey') };
});

// First launch: download the speech model (~150MB) with pill progress.
async function bootEngine() {
  pill.showInactive();
  setPillState('processing', 'First run: downloading speech model…');
  try {
    await ensureEngine((fraction) => {
      setPillState('processing', `Downloading model… ${Math.round(fraction * 100)}%`);
    });
    engineReady = true;
    console.log('[main] speech engine ready');
    pill.hide();
  } catch (err) {
    console.error('[main] engine failed:', err.message);
    setPillState('error', 'Model download failed — check internet');
  }
}

app.whenReady().then(() => {
  createPill();
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle('FlowTate');
  tray.setToolTip('FlowTate — voice dictation');
  buildTrayMenu();
  registerHotkey();
  console.log('[main] ready');
  bootEngine(); // async — pill shows download progress
});

app.on('window-all-closed', (e) => e.preventDefault());
app.on('will-quit', () => globalShortcut.unregisterAll());
