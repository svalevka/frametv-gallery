const express = require('express');
const path = require('path');
const { ImageIndex } = require('./lib/index');
const { getThumbnail } = require('./lib/thumbnails');
const { sendToTV, tvConfigured } = require('./lib/tv');

const PORT = process.env.PORT || 4173;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const index = new ImageIndex();
console.log(`Indexing images under ${index.sourceRoot} ...`);
const buildResult = index.build();
console.log(
  buildResult.available
    ? `Indexed ${buildResult.count} unique images.`
    : `Source disk not found at ${index.sourceRoot}.`
);

app.get('/api/status', (req, res) => {
  res.json({
    available: index.available,
    count: index.images.length,
    builtAt: index.builtAt,
    sourceRoot: index.sourceRoot,
  });
});

app.post('/api/reindex', (req, res) => {
  const result = index.build();
  res.json(result);
});

app.get('/api/filters', (req, res) => {
  res.json(index.getFilters());
});

app.get('/api/images', (req, res) => {
  const { q, movement, century, letter } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 60));

  const result = index.search({ q, movement, century, letter, page, pageSize });

  result.items = result.items.map((img) => ({
    id: img.id,
    artist: img.artist,
    title: img.title,
    filename: img.filename,
    movements: img.movements,
    centuries: img.centuries,
  }));

  res.json(result);
});

app.get('/api/thumb/:id', async (req, res) => {
  const image = index.get(req.params.id);
  if (!image) return res.status(404).end();
  try {
    const thumbPath = await getThumbnail(image);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(thumbPath);
  } catch (err) {
    console.error(`Thumbnail failed for ${image.path}:`, err.message);
    res.status(500).end();
  }
});

app.get('/api/full/:id', (req, res) => {
  const image = index.get(req.params.id);
  if (!image) return res.status(404).end();
  res.sendFile(image.path);
});

app.get('/api/tv/status', (req, res) => {
  res.json({ configured: tvConfigured() });
});

app.post('/api/tv/send', async (req, res) => {
  if (!tvConfigured()) {
    return res.status(400).json({ error: 'FRAMETV_TV_IP is not set. Set it to your Frame TV\'s IP address.' });
  }
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const images = ids.map((id) => index.get(id)).filter(Boolean);
  if (images.length === 0) return res.json({ results: [] });

  try {
    const result = await sendToTV(images.map((img) => img.path));
    res.json(result);
  } catch (err) {
    console.error('Send to TV failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`FrameTV gallery running at http://localhost:${PORT}`);
});
