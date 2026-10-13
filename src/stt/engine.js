// FlowTate — cross-platform local STT via Transformers.js (ONNX Whisper).
// No API keys, no accounts, no platform-specific installs: the model (~150MB)
// downloads itself into the app's userData dir on first launch.
const fs = require('fs');
const path = require('path');
const os = require('os');

const MODEL_ID = 'Xenova/whisper-base.en';

let _pipe = null;
let _ready = null;

function modelsDir() {
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      return path.join(app.getPath('userData'), 'models');
    }
  } catch { /* plain node (smoke tests): fall through */ }
  return path.join(os.homedir(), '.flowtate', 'models');
}

// Downloads the model on first run (progress 0..1), then resolves the pipeline.
// Safe to call repeatedly; concurrent callers share one download.
async function ensureEngine(onProgress) {
  if (_pipe) return _pipe;
  if (_ready) return _ready;
  _ready = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.cacheDir = modelsDir();
    env.allowRemoteModels = true;
    _pipe = await pipeline('automatic-speech-recognition', MODEL_ID, {
      progress_callback: (p) => {
        if (!onProgress) return;
        if (p.status === 'progress' && p.total) onProgress(p.loaded / p.total, p.file);
        else if (p.status === 'done') onProgress(1, p.file);
      },
    });
    return _pipe;
  })().catch((err) => { _ready = null; throw err; });
  return _ready;
}

// Minimal 16-bit PCM WAV reader. Node has no AudioContext, so the pipeline
// gets raw samples: { raw: Float32Array, sampling_rate }.
function readWavPcm16(wavPath) {
  const buf = fs.readFileSync(wavPath);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a WAV file: ' + wavPath);
  }
  let offset = 12, fmt = null, dataStart = 0, dataLen = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buf.readUInt16LE(offset + 8),
        channels: buf.readUInt16LE(offset + 10),
        sampleRate: buf.readUInt32LE(offset + 12),
        bitsPerSample: buf.readUInt16LE(offset + 22),
      };
    } else if (id === 'data') {
      dataStart = offset + 8;
      dataLen = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (!fmt || !dataStart) throw new Error('WAV parse failed: ' + wavPath);
  if (fmt.audioFormat !== 1 || fmt.bitsPerSample !== 16) {
    throw new Error('need 16-bit PCM WAV, got format=' + fmt.audioFormat);
  }
  const n = Math.floor(dataLen / 2 / fmt.channels);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let c = 0; c < fmt.channels; c++) {
      sum += buf.readInt16LE(dataStart + (i * fmt.channels + c) * 2);
    }
    out[i] = (sum / fmt.channels) / 32768;
  }
  return { data: out, samplingRate: fmt.sampleRate };
}

// wavPath: 16kHz mono WAV (we produce it via ffmpeg). Returns transcript text.
// NOTE: transformers.js v4 wants a raw Float32Array (model's 16kHz assumed).
async function transcribeFile(wavPath) {
  const pipe = await ensureEngine();
  const { data } = readWavPcm16(wavPath);
  const out = await pipe(data, { chunk_length_s: 30, stride_length_s: 5 });
  const text = Array.isArray(out) ? out.map((o) => o.text).join(' ') : (out.text || '');
  return text.trim();
}

module.exports = { ensureEngine, transcribeFile, MODEL_ID, modelsDir };
