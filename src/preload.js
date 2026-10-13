// FlowTate — context bridge between pill renderer and main.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flowtate', {
  onState: (cb) => ipcRenderer.on('pill-state', (_e, s) => cb(s)),
  onRecordStart: (cb) => ipcRenderer.on('pill-record-start', cb),
  onRecordStop: (cb) => ipcRenderer.on('pill-record-stop', cb),
  sendAudioChunk: (buf) => ipcRenderer.send('audio-chunk', buf),
  recordingFlushed: () => ipcRenderer.invoke('recording-flushed'),
});
