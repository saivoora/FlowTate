// FlowTate — cross-platform text injection: clipboard + simulated paste.
// No native modules: each platform uses its built-in automation facility.
const { clipboard } = require('electron');
const { execFile } = require('child_process');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout, stderr) => err
      ? reject(new Error(`${cmd}: ${String(stderr || err.message).slice(0, 160)}`))
      : resolve(stdout));
  });
}

async function pasteKeystroke() {
  const plat = process.platform;
  if (plat === 'darwin') {
    // Needs Accessibility permission (one-time prompt).
    await run('/usr/bin/osascript', [
      '-e', 'tell application "System Events" to keystroke "v" using command down',
    ]);
  } else if (plat === 'win32') {
    await run('powershell', [
      '-NoProfile', '-Command',
      "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
    ]);
  } else {
    // Linux: X11 via xdotool, Wayland via wtype.
    try {
      await run('xdotool', ['key', 'ctrl+v']);
    } catch {
      await run('wtype', ['-M', 'ctrl', '-k', 'v', '-m', 'ctrl']).catch(() => {
        throw new Error('Paste failed: install xdotool (X11) or wtype (Wayland).');
      });
    }
  }
}

async function injectText(text) {
  clipboard.writeText(text);
  await new Promise((r) => setTimeout(r, 150)); // let the clipboard settle
  try {
    await pasteKeystroke();
  } catch (err) {
    throw new Error(
      'Paste failed (' + err.message + '). The text is on your clipboard — press Ctrl/Cmd+V.'
    );
  }
}

module.exports = { injectText };
