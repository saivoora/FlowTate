# FlowTate (working title)

Local-first voice dictation for macOS. Press the hotkey, talk, text appears
wherever your cursor is.

## Quick start (Mac Mini)

```bash
cd ~/flowtate
npm install
npm run setup-stt   # installs whisper-cpp + ffmpeg, downloads base.en model (~150MB)
npm start
```

Default hotkey: `CommandOrControl+Shift+Space` (press to start, press again to
stop and paste). First run will prompt for Microphone access; pasting needs
Accessibility permission (System Settings → Privacy & Security).

See `ARCHITECTURE.md` for the design and milestones.
