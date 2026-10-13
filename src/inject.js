// FlowTate — text injection: clipboard + simulated Cmd+V paste.
// (Wispr Flow isolates this in a utilityProcess helper; we harden later.)
const { clipboard } = require('electron');
const { execFile } = require('child_process');

function injectText(text) {
  clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/osascript',
      ['-e', 'tell application "System Events" to keystroke "v" using command down'],
      (err) => err
        ? reject(new Error('paste failed — grant Accessibility permission (System Settings → Privacy & Security). ' + err.message))
        : resolve());
  });
}

module.exports = { injectText };
