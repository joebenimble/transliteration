const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const multer = require('multer');

const { MemoStore } = require('./memos');
const { ProcessingQueue } = require('./processing');
const { createAuthMiddleware } = require('./auth');

const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || 'devpassword';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

fs.mkdirSync(DATA_DIR, { recursive: true });

const memoStore = new MemoStore(DATA_DIR);
const processingQueue = new ProcessingQueue(memoStore);
const { requireAuth, handleLogin, handleLogout } = createAuthMiddleware(APP_PASSWORD);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, memoStore.uploadsDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${crypto.randomUUID()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isWav = file.mimetype === 'audio/wav' ||
      file.mimetype === 'audio/x-wav' ||
      file.originalname.toLowerCase().endsWith('.wav');
    cb(null, isWav);
  }
});

const app = express();

if (COOKIE_SECURE) {
  app.set('trust proxy', 1);
}

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

const publicDir = path.join(__dirname, '..', 'public');

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/login.html', (_req, res) => {
  res.sendFile(path.join(publicDir, 'login.html'));
});

app.post('/login', handleLogin);
app.post('/logout', handleLogout);

app.use(requireAuth);
app.use(express.static(publicDir));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'app.html'));
});

app.get('/api/status', (_req, res) => {
  const queueStatus = processingQueue.getStatus();
  const memoPage = memoStore.getMemoPage();
  res.json({
    ...queueStatus,
    pendingMemos: memoPage.totalRemaining
  });
});

app.post('/api/upload', upload.array('files'), (req, res) => {
  const files = req.files || [];

  if (files.length === 0) {
    return res.status(400).json({ error: 'No .wav files uploaded' });
  }

  for (const file of files) {
    processingQueue.enqueue(file.path, file.originalname);
  }

  res.json({
    uploaded: files.length,
    ...processingQueue.getStatus()
  });
});

app.get('/api/memos', (_req, res) => {
  res.json(memoStore.getMemoPage());
});

app.patch('/api/memos/:id', (req, res) => {
  const { transcription } = req.body;
  const updated = memoStore.updatePendingMemoText(req.params.id, transcription ?? '');

  if (!updated) {
    return res.status(404).json({ error: 'Memo not found' });
  }

  res.json({ ok: true });
});

app.delete('/api/memos/:id', (req, res) => {
  const deleted = memoStore.deleteMemo(req.params.id);

  if (!deleted) {
    return res.status(404).json({ error: 'Memo not found' });
  }

  res.json(memoStore.getMemoPage());
});

app.post('/api/memos/submit', (req, res) => {
  const submissions = req.body.submissions;

  if (!Array.isArray(submissions)) {
    return res.status(400).json({ error: 'submissions array required' });
  }

  try {
    const pageData = memoStore.submitPendingMemos(submissions);
    res.json(pageData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/audio/:id', (req, res) => {
  const memo = memoStore.getMemoById(req.params.id);

  if (!memo || !fs.existsSync(memo.wavPath)) {
    return res.status(404).json({ error: 'Audio not found' });
  }

  const filePath = path.resolve(memo.wavPath);
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'audio/wav');

  if (!range) {
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  if (start >= fileSize || end >= fileSize) {
    res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
    return res.end();
  }

  const chunkSize = end - start + 1;
  res.status(206);
  res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
  res.setHeader('Content-Length', chunkSize);
  fs.createReadStream(filePath, { start, end }).pipe(res);
});

app.delete('/api/transcriptions', (_req, res) => {
  memoStore.resetTranscriptionsFile();
  res.json({ ok: true });
});

app.get('/api/transcriptions', (_req, res) => {
  const filePath = memoStore.transcriptionsPath;

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'No transcriptions yet' });
  }

  res.download(filePath, 'transcriptions.txt');
});

app.listen(PORT, () => {
  console.log(`Speech-to-text web app listening on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Login password: ${process.env.APP_PASSWORD ? 'from APP_PASSWORD env' : 'default (devpassword)'}`);
  console.log(`Secure cookies: ${COOKIE_SECURE ? 'enabled (COOKIE_SECURE=true)' : 'disabled'}`);
});
