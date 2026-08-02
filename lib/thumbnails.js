const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const THUMB_DIR = path.join(__dirname, '..', '.cache', 'thumbs');
const THUMB_WIDTH = 420;

fs.mkdirSync(THUMB_DIR, { recursive: true });

function thumbPathFor(id) {
  return path.join(THUMB_DIR, `${id}.jpg`);
}

async function getThumbnail(image) {
  const dest = thumbPathFor(image.id);
  if (fs.existsSync(dest)) return dest;

  await sharp(image.path)
    .rotate() // respect EXIF orientation
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 78 })
    .toFile(dest);

  return dest;
}

module.exports = { getThumbnail };
