# FlowTate — Architecture & Build Plan

Working title. Voice dictation for macOS, clean-room implementation informed by
REA analysis of Wispr Flow 1.6.1102 (Phase 1, 2026-10-13). We learn the
architecture; every line of code here is our own.

## REA-derived architecture map (what we learned)

| Stage | Wispr Flow does | We do (v0.1) |
|---|---|---|
| Hotkey | Electron `globalShortcut` (configurable) | Same. Toggle mode first (press=start, press=stop). Hold-to-talk later via uiohook-napi |
| Mic capture | Renderer Web APIs (`getUserMedia`/`MediaRecorder`) | Same |
| Transcription | gRPC bidirectional streaming to their cloud (partials while talking) | Local `whisper-cpp` (brew) + base.en model. Streaming provider (Deepgram) = pluggable later |
| Polish pass | LLM cleanup after ASR: fillers, punctuation, spoken self-corrections (`pasted_text \|\| llm_text`) | Passthrough stub in v0.1; real pass in v0.2 |
| Text injection | `clipboard.writeText` + simulated Cmd+V paste; key-sim isolated in an Electron `utilityProcess` helper | `clipboard.writeText` + `osascript` Cmd+V in main (helper-process isolation = later hardening) |
| Overlay | Frameless click-through `statusWindow` pill following the cursor | Same: frameless, transparent, alwaysOnTop, click-through |
| Local data | sqlite3 + electron-store | electron-store only for v0.1 |
| Permissions | Accessibility (paste), Input Monitoring (hotkey), Microphone | Same three macOS prompts on first run |

## Module layout

- `src/main.js` — app lifecycle, tray, pill window, globalShortcut, pipeline orchestration
- `src/preload.js` — context bridge (`window.flowtate`)
- `src/inject.js` — clipboard + Cmd+V paste via osascript
- `src/polish.js` — post-ASR cleanup (stub → LLM in v0.2)
- `src/stt/whisper-local.js` — local whisper-cpp provider (interface fits future cloud providers)
- `src/renderer/` — pill UI + MediaRecorder capture

## Milestones

- [x] M0 Scaffold (this doc + project skeleton)
- [ ] M1 Core loop: hotkey toggle → record → transcribe → paste → pill feedback
- [ ] M2 Polish pass (local small LLM or cloud)
- [ ] M3 Hold-to-talk, settings UI, launch-at-login
- [ ] M4 Push working prototype to Sai's GitHub repo
