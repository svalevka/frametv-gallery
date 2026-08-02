const fs = require('fs');
const path = require('path');
const { EXTERNAL_ROOT } = require('./index');

const FRAMETV_DIR = path.join(EXTERNAL_ROOT, 'FrameTV');

function ensureDir() {
  fs.mkdirSync(FRAMETV_DIR, { recursive: true });
}

function listFrameTV() {
  ensureDir();
  return fs
    .readdirSync(FRAMETV_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
}

function copyToFrameTV(images) {
  ensureDir();
  const copied = [];
  const skipped = [];
  for (const image of images) {
    const dest = path.join(FRAMETV_DIR, image.filename);
    if (fs.existsSync(dest)) {
      skipped.push(image.filename);
      continue;
    }
    fs.copyFileSync(image.path, dest);
    copied.push(image.filename);
  }
  return { copied, skipped };
}

function removeFromFrameTV(filename) {
  ensureDir();
  const safeName = path.basename(filename);
  const target = path.join(FRAMETV_DIR, safeName);
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
    return true;
  }
  return false;
}

module.exports = { FRAMETV_DIR, listFrameTV, copyToFrameTV, removeFromFrameTV };
