# Frame TV Gallery

A local web app for browsing, searching, and picking wallpaper art for a
Samsung Frame TV from a large image collection on an external drive.

It expects the drive to contain the same paintings organized into multiple
parallel folder trees (e.g. by artist surname, by art movement, by century),
as produced by common "art for Frame TV" collections. The app deduplicates
across those trees so each painting shows up once, and turns the folder
structure into search filters.

## Features

- **Search** by artist or title
- **Filter** by art movement, century, and artist-surname letter
- **Infinite-scroll grid** with lazily-loaded, cached thumbnails
- **Lightbox preview** with prev/next navigation (click the arrows or use
  the ← / → arrow keys)
- **Select images** (in the grid or from the lightbox) and **send them to a
  `FrameTV` folder** on the source drive with one click
- **Share via AirDrop** — sends the full-resolution original to the native
  macOS/iOS share sheet (AirDrop is one of the share targets there; the Web
  Share API has no way to open AirDrop directly). Falls back to a normal
  download if the browser doesn't support sharing files.

## Requirements

- Node.js 18+
- The image collection mounted locally, by default at `/Volumes/External`

## Setup

```bash
npm install
```

## Running

```bash
npm start
```

Then open http://localhost:4173

The app indexes the collection once at startup (a few seconds for tens of
thousands of files) and caches generated thumbnails to `.cache/thumbs/` so
repeat browsing is fast.

### Pointing at a different drive/folder

By default the app looks for the source images at `/Volumes/External`. To
use a different location:

```bash
FRAMETV_SOURCE_ROOT="/path/to/your/drive" npm start
```

### Re-indexing

If you add or remove images while the server is running, either restart it
or trigger a re-index without restarting:

```bash
curl -X POST http://localhost:4173/api/reindex
```

## Expected folder layout

The indexer looks for these subfolders under the source root (any that
don't exist are simply skipped):

```
<source root>/
├── Sorted by Surename/<Letter>/<Artist>/<file>.jpg
├── Sorted by Art Movement/<Movement>/<file>.jpg
├── Sorted by Century/<Century>/<file>.jpg
└── FrameTV/                      # destination for "Send to Frame TV"
```

Images are de-duplicated by filename across the three trees; whichever tree
they're found in becomes a filter tag (letter / movement / century) on that
image. Filenames are expected to follow an `Artist - Title.jpg` pattern for
artist/title parsing — files that don't match are shown with artist
"Unknown".

## How "Send to Frame TV" works

Selecting images and clicking **Send to Frame TV** copies the original
full-resolution files into `<source root>/FrameTV`. Images already present
there are skipped (not re-copied), and the grid marks them with an
**On TV** badge. You can remove a file from that folder again via:

```bash
curl -X DELETE "http://localhost:4173/api/frametv/<filename>"
```

## Project layout

```
server.js          Express app + API routes
lib/index.js        Scans the source root and builds the in-memory image index
lib/thumbnails.js   Generates and caches resized JPEG thumbnails (sharp)
lib/frametv.js       Copy/list/remove helpers for the FrameTV destination folder
public/              Static frontend (plain HTML/CSS/JS, no build step)
```
