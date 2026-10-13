# FlowTate — Architecture & Build Plan

Voice dictation for macOS, Windows and Linux. Clean-room implementation
informed by REA analysis of Wispr Flow 1.6.1102 (Phase 1, 2026-10-13) — we
learned the architecture; every line of code here is our own.

## Design principles

- **One codebase, three platforms.** No per-OS code paths except where the OS
  forces it (paste simulation). No native modules, no Homebrew, no compilers —
  `npm install` is the whole toolchain.
- **No accounts, no API keys.** Speech recognition runs locally via ONNX
  Whisper; the model downloads itself on first launch (~150 MB, cached in the
  app's userData dir). After that the app works fully offline.

## Pipeline

| Stage | Implementation (all platforms) |
|---|---|
| Hotkey | Electron `globalShortcut` (default Ctrl/Cmd+Shift+Space, toggle mode) |
| Mic capture | Renderer Web APIs (`getUserMedia`/`MediaRecorder` → webm/opus chunks over IPC) |
| Audio prep | `@ffmpeg-installer/ffmpeg` static binary → 16 kHz mono WAV |
| Transcription | `@huggingface/transformers` (ONNX `Xenova/whisper-base.en`), `src/stt/engine.js` |
| Polish pass | `src/polish.js` — light cleanup in v0.1; LLM pass in v0.2 |
| Text injection | `src/inject.js` — clipboard + simulated paste per OS: macOS `osascript`, Windows PowerShell `SendKeys`, Linux `xdotool`/`wtype` |
| Overlay | Frameless click-through pill (`statusWindow`), follows the cursor |
| Settings | `electron-store` (hotkey) |
| First run | `bootEngine()` in main: downloads the model with pill progress bar |

## Module layout

- `src/main.js` — lifecycle, tray, pill window, hotkey, orchestration, first-run setup
- `src/preload.js` — context bridge (`window.flowdictate`)
- `src/audio.js` — webm → 16k WAV via bundled ffmpeg
- `src/stt/engine.js` — ONNX Whisper pipeline, lazy singleton, shared download
- `src/inject.js` — cross-platform clipboard + paste
- `src/polish.js` — post-ASR cleanup (stub → LLM in v0.2)
- `src/renderer/` — pill UI + MediaRecorder capture

## Packaging & distribution

- `electron-builder`: `.dmg` (mac), NSIS `.exe` (win), `.AppImage` (linux).
  `asarUnpack: **/*.node` so onnxruntime's native bindings load from the
  packaged app.
- `.github/workflows/release.yml`: push a `v*` tag → matrix build on
  macos/windows/ubuntu runners → installers attached to the GitHub Release.
- Unsigned for now (Gatekeeper/SmartScreen warnings expected); signing is a
  later step (Apple Developer $99/yr, Windows cert ~$200/yr).

## Milestones

- [x] M0 Scaffold + Mac prototype (whisper.cpp path, since replaced)
- [x] M1 Cross-platform refactor (transformers.js, per-OS paste, builder, CI)
- [ ] M2 Live loop verified on Mac (mic + accessibility permissions — needs Sai)
- [ ] M3 Polish pass (local small LLM or cloud)
- [ ] M4 Hold-to-talk, settings UI, launch-at-login, auto-update
