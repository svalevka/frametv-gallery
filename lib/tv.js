const path = require('path');
const { spawn } = require('child_process');

const TV_IP = process.env.FRAMETV_TV_IP;
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');
const PYTHON = path.join(SCRIPTS_DIR, 'venv', 'bin', 'python3');
const UPLOAD_SCRIPT = path.join(SCRIPTS_DIR, 'upload_to_tv.py');
const TOKEN_FILE = path.join(SCRIPTS_DIR, '.tv-token.txt');

function tvConfigured() {
  return Boolean(TV_IP);
}

function sendToTV(imagePaths) {
  return new Promise((resolve, reject) => {
    const args = [UPLOAD_SCRIPT, '--ip', TV_IP, '--token-file', TOKEN_FILE, ...imagePaths];
    const proc = spawn(PYTHON, args);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));

    proc.on('error', (err) => reject(err));
    proc.on('close', () => {
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(stderr.trim() || 'Upload script produced no output'));
      }
    });
  });
}

module.exports = { sendToTV, tvConfigured };
