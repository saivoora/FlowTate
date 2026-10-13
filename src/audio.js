// FlowTate — audio conversion via the bundled static ffmpeg (all platforms).
const { execFile } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

// MediaRecorder gives us webm/opus; the STT engine wants 16kHz mono WAV.
function toWav16k(inputPath) {
  const out = inputPath.replace(/\.webm$/, '.wav');
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath,
      ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', out],
      (err, _stdout, stderr) => err
        ? reject(new Error('ffmpeg: ' + String(stderr).slice(-200)))
        : resolve(out));
  });
}

module.exports = { toWav16k, ffmpegPath };
