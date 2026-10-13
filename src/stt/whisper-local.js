// FlowTate — local STT provider (whisper.cpp via Homebrew; binary is `whisper-cli` in recent releases).
// Interface: transcribeFile(wavPath16k) -> Promise<string>.
// Future providers (e.g. Deepgram streaming) implement the same interface.
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MODEL = path.join(os.homedir(), 'flowtate', 'models', 'ggml-base.en.bin');

function transcribeFile(wavPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(MODEL)) {
      return reject(new Error('whisper model missing — run: npm run setup-stt'));
    }
    const outBase = wavPath.replace(/\.wav$/, '');
    execFile('whisper-cli',
      ['-m', MODEL, '-f', wavPath, '-of', outBase, '--output-txt', '--no-timestamps', '-t', '8'],
      (err, _stdout, stderr) => {
        if (err) return reject(new Error('whisper-cli: ' + String(stderr).slice(-300)));
        try {
          resolve(fs.readFileSync(outBase + '.txt', 'utf8').trim());
        } catch (e) {
          reject(new Error('whisper produced no output'));
        }
      });
  });
}

module.exports = { transcribeFile, MODEL };
