# FlowTate

Local-first voice dictation for **macOS, Windows and Linux**. Press the hotkey,
talk, and your words appear wherever your cursor is. No accounts, no API keys,
no cloud — speech recognition runs on your own machine.

## Install

Download the installer for your platform from the
[**Releases**](https://github.com/saivoora/flowtate/releases) page
(`.dmg` for Mac, `.exe` for Windows, `.AppImage` for Linux) and run it.

On first launch the app downloads its speech model (~150 MB) once, then works
fully offline.

> Unsigned builds: your OS may warn on first run (Gatekeeper / SmartScreen).
> That's expected for now — allow the app and carry on.

## Use

1. Click any text field.
2. Press **Ctrl+Shift+Space** (or **Cmd+Shift+Space** on Mac) and speak.
3. Press the hotkey again — the transcribed text is pasted at your cursor.

macOS will ask for Microphone and Accessibility permissions on first use;
both are required (mic to hear you, accessibility to paste).

Linux note: pasting needs `xdotool` (X11) or `wtype` (Wayland) installed.

## Build from source

```bash
npm install
npm start        # dev run
npm run dist     # build the installer for your platform
```

Pushing a tag like `v0.1.0` triggers GitHub Actions, which builds all three
platform installers and attaches them to the release automatically.

## How it works

See [ARCHITECTURE.md](ARCHITECTURE.md). In short: Electron shell → global
hotkey → mic capture in the renderer → local Whisper (ONNX) transcription →
clipboard + simulated paste → floating pill UI. Inspired by studying Wispr
Flow's architecture; every line here is original.
