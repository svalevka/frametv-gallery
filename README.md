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
- **Send to TV (Wi-Fi)** — uploads selected images straight into the Frame
  TV's Art Mode collection over the local network, no phone or AirDrop
  involved. Only shown once `FRAMETV_TV_IP` is configured (see below).

## Requirements

- Node.js 18+
- The image collection mounted locally, by default at `/Volumes/External`
- For **Send to TV (Wi-Fi)**: Python 3 and the TV on the same network (see
  [Setting up direct Wi-Fi upload](#setting-up-direct-wi-fi-upload))

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

## Setting up direct Wi-Fi upload

"Send to TV (Wi-Fi)" talks to the Frame TV's Art Mode WebSocket API using the
[`samsungtvws`](https://github.com/xchwarze/samsung-tv-ws-api) Python
library, shelled out to from the Node server. It skips AirDrop and the phone
app entirely.

1. Find the TV's IP address. It's usually visible in **Settings > General >
   Network > Network Status** on the TV, or discoverable from a Mac via
   `dns-sd -B _airplay._tcp local` (Frame TVs advertise AirPlay) followed by
   `dns-sd -L "<name>" _airplay._tcp local` to resolve the hostname.
2. Create a virtualenv and install the library:
   ```bash
   cd scripts
   python3 -m venv venv
   ./venv/bin/pip install samsungtvws websocket-client
   ```
3. Start the app with the TV's IP set:
   ```bash
   FRAMETV_TV_IP="192.168.1.163" npm start
   ```
   The "Send to TV (Wi-Fi)" buttons only appear once this is set.

The first upload may pop up an "Allow connection?" prompt on the TV itself —
accept it with the remote. After that, `scripts/.tv-token.txt` caches the
auth token so future uploads connect silently. Both `scripts/venv/` and
`scripts/.tv-token.txt` are gitignored (per-machine, and the token is
TV-specific).

You can also run the uploader directly, without the web app:

```bash
cd scripts
./venv/bin/python3 upload_to_tv.py --ip 192.168.1.163 --token-file .tv-token.txt /path/to/image1.jpg /path/to/image2.jpg
```

## Project layout

```
server.js          Express app + API routes
lib/index.js        Scans the source root and builds the in-memory image index
lib/thumbnails.js   Generates and caches resized JPEG thumbnails (sharp)
lib/frametv.js       Copy/list/remove helpers for the FrameTV destination folder
lib/tv.js            Shells out to scripts/upload_to_tv.py for direct Wi-Fi upload
scripts/upload_to_tv.py  Uploads images to Art Mode via the samsungtvws library
public/              Static frontend (plain HTML/CSS/JS, no build step)
```
