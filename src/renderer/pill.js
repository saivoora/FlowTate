// FlowTate — pill UI + mic capture via MediaRecorder.
const label = document.getElementById('label');
const pill = document.getElementById('pill');
let recorder = null;
let stream = null;
let pendingSends = [];

window.flowtate.onState(({ state, text }) => {
  pill.dataset.state = state;
  if (state === 'listening') label.textContent = 'Listening… (hotkey to stop)';
  else if (state === 'processing') label.textContent = text || 'Transcribing…';
  else if (state === 'done') label.textContent = text ? '✓ ' + text : 'Done';
  else if (state === 'error') label.textContent = '⚠ ' + text;
});

window.flowtate.onRecordStart(async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    pendingSends = [];
    recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        pendingSends.push(
          e.data.arrayBuffer().then((buf) => window.flowtate.sendAudioChunk(buf))
        );
      }
    };
    recorder.start(500);
  } catch (err) {
    label.textContent = '⚠ Mic blocked — allow Microphone access';
    pill.dataset.state = 'error';
  }
});

window.flowtate.onRecordStop(async () => {
  if (!recorder) { window.flowtate.recordingFlushed(); return; }
  recorder.onstop = async () => {
    try { await Promise.all(pendingSends); } catch (e) { /* best effort */ }
    pendingSends = [];
    if (stream) stream.getTracks().forEach((t) => t.stop());
    recorder = null;
    window.flowtate.recordingFlushed();
  };
  recorder.stop();
});
