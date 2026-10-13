// FlowTate — STT pipeline smoke test (no mic/GUI needed).
// Usage: node scripts/smoke-stt.js /tmp/fd-test.wav
// First run downloads the model (~150MB) into ~/.flowtate/models.
const { transcribeFile } = require('../src/stt/engine');
const { polish } = require('../src/polish');

(async () => {
  const wav = process.argv[2] || '/tmp/fd-test.wav';
  const raw = await transcribeFile(wav);
  const final = await polish(raw);
  console.log('RAW:      ', JSON.stringify(raw));
  console.log('POLISHED: ', JSON.stringify(final));
  console.log('SMOKE OK');
})().catch((e) => { console.error('SMOKE FAIL:', e.message); process.exit(1); });
