const fs = require('fs');
const path = require('path');

const EXTERNAL_ROOT = process.env.FRAMETV_SOURCE_ROOT || '/Volumes/External';

// Each source tree is scanned for image files. "letter-artist" trees have an
// extra artist-folder level; "flat" trees have images directly under the tag folder.
const SOURCES = [
  { dir: 'Sorted by Surename', depth: 'letter-artist', tagType: 'letter' },
  { dir: 'Sorted by Art Movement', depth: 'flat', tagType: 'movement' },
  { dir: 'Sorted by Century', depth: 'flat', tagType: 'century' },
];

const IMAGE_EXT_RE = /\.(jpe?g|png|tiff?|bmp|webp)$/i;

const TAG_PROP = { letter: 'letters', movement: 'movements', century: 'centuries' };

function isImageFile(name) {
  if (name.startsWith('.')) return false; // skip AppleDouble ._ files, .DS_Store, dotfiles
  return IMAGE_EXT_RE.test(name);
}

function parseArtistTitle(basename) {
  const nameNoExt = basename.replace(/\.[^.]+$/, '');
  const idx = nameNoExt.indexOf(' - ');
  if (idx === -1) {
    return { artist: 'Unknown', title: nameNoExt };
  }
  return {
    artist: nameNoExt.slice(0, idx).trim(),
    title: nameNoExt.slice(idx + 3).trim(),
  };
}

function centurySortKey(label) {
  const m = /^(\d+)/.exec(label);
  return m ? parseInt(m[1], 10) : 999;
}

class ImageIndex {
  constructor() {
    this.images = [];
    this.byId = new Map();
    this.builtAt = null;
    this.sourceRoot = EXTERNAL_ROOT;
    this.available = false;
  }

  build() {
    if (!fs.existsSync(EXTERNAL_ROOT)) {
      this.available = false;
      this.images = [];
      this.byId = new Map();
      return { available: false, count: 0 };
    }

    const byKey = new Map();
    let nextId = 1;

    const scanFiles = (dirPath, tagType, tagValue) => {
      let entries;
      try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (!e.isFile() || !isImageFile(e.name)) continue;
        const fullPath = path.join(dirPath, e.name);
        const key = e.name.toLowerCase();
        let entry = byKey.get(key);
        if (!entry) {
          const { artist, title } = parseArtistTitle(e.name);
          entry = {
            id: nextId++,
            filename: e.name,
            path: fullPath,
            artist,
            title,
            movements: new Set(),
            centuries: new Set(),
            letters: new Set(),
          };
          byKey.set(key, entry);
        }
        entry[TAG_PROP[tagType]].add(tagValue);
      }
    };

    for (const source of SOURCES) {
      const rootDir = path.join(EXTERNAL_ROOT, source.dir);
      if (!fs.existsSync(rootDir)) continue;
      let level1;
      try {
        level1 = fs.readdirSync(rootDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const l1 of level1) {
        if (!l1.isDirectory() || l1.name.startsWith('.')) continue;
        const tagValue = l1.name;
        const l1Path = path.join(rootDir, l1.name);

        if (source.depth === 'letter-artist') {
          let artistDirs;
          try {
            artistDirs = fs.readdirSync(l1Path, { withFileTypes: true });
          } catch {
            continue;
          }
          for (const ad of artistDirs) {
            if (!ad.isDirectory() || ad.name.startsWith('.')) continue;
            scanFiles(path.join(l1Path, ad.name), source.tagType, tagValue);
          }
        } else {
          scanFiles(l1Path, source.tagType, tagValue);
        }
      }
    }

    const images = Array.from(byKey.values()).map((e) => ({
      id: e.id,
      filename: e.filename,
      path: e.path,
      artist: e.artist,
      title: e.title,
      movements: Array.from(e.movements).sort(),
      centuries: Array.from(e.centuries).sort((a, b) => centurySortKey(a) - centurySortKey(b)),
      letters: Array.from(e.letters).sort(),
    }));

    images.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));

    this.images = images;
    this.byId = new Map(images.map((img) => [img.id, img]));
    this.builtAt = new Date();
    this.available = true;
    return { available: true, count: images.length };
  }

  get(id) {
    return this.byId.get(Number(id));
  }

  getFilters() {
    const movements = new Set();
    const centuries = new Set();
    const letters = new Set();
    for (const img of this.images) {
      img.movements.forEach((m) => movements.add(m));
      img.centuries.forEach((c) => centuries.add(c));
      img.letters.forEach((l) => letters.add(l));
    }
    return {
      movements: Array.from(movements).sort(),
      centuries: Array.from(centuries).sort((a, b) => centurySortKey(a) - centurySortKey(b)),
      letters: Array.from(letters).sort(),
    };
  }

  search({ q, movement, century, letter, page = 1, pageSize = 60 }) {
    let results = this.images;

    if (q && q.trim()) {
      const needle = q.trim().toLowerCase();
      results = results.filter(
        (img) =>
          img.artist.toLowerCase().includes(needle) || img.title.toLowerCase().includes(needle)
      );
    }
    if (movement) {
      results = results.filter((img) => img.movements.includes(movement));
    }
    if (century) {
      results = results.filter((img) => img.centuries.includes(century));
    }
    if (letter) {
      results = results.filter((img) => img.letters.includes(letter));
    }

    const total = results.length;
    const start = (page - 1) * pageSize;
    const items = results.slice(start, start + pageSize);

    return { total, page, pageSize, items };
  }
}

module.exports = { ImageIndex, EXTERNAL_ROOT };
