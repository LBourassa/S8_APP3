const path = require('path');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-saqlicpo',
  resave: false,
  saveUninitialized: false,
}));

// Rend l'utilisateur courant disponible dans les vues.
app.use((req, res, next) => { res.locals.user = req.session.user || null; next(); });

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send('Accès réservé à l\'administrateur');
  }
  next();
}

// --- Authentification ---
app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.load('users').find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).render('login', { error: 'Identifiants invalides.' });
  }
  req.session.user = { id: user.id, username: user.username, role: user.role, name: user.name };
  res.redirect('/');
});

app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

// --- Tableau de bord : documents ---
app.get('/', requireLogin, (req, res) => {
  res.render('dashboard', { documents: db.load('documents') });
});

// --- Téléversement (tout utilisateur connecté) ---
const upload = multer({ dest: path.join(__dirname, 'uploads') });
app.post('/upload', requireLogin, upload.single('file'), (req, res) => {
  if (!req.file) return res.redirect('/');
  const docs = db.load('documents');
  const id = docs.reduce((m, d) => Math.max(m, d.id), 0) + 1;
  docs.push({
    id,
    name: req.file.originalname,
    stored: req.file.filename,
    clinic: req.body.clinic || '—',
    uploadedBy: req.session.user.username,
  });
  db.save('documents', docs);
  res.redirect('/');
});

// --- Téléchargement d'un document (admin uniquement) ---
app.get('/download/:id', requireLogin, requireAdmin, (req, res) => {
  const doc = db.load('documents').find(d => String(d.id) === req.params.id);
  if (!doc) return res.status(404).send('Document introuvable');
  res.download(path.join(__dirname, 'uploads', doc.stored), doc.name, (err) => {
    if (err && !res.headersSent) res.status(404).send('Fichier manquant sur le disque');
  });
});

// 404 pour toute autre route.
app.use((req, res) => res.status(404).send('Page introuvable'));

app.listen(PORT, () => console.log(`SAQLICPO sur http://localhost:${PORT}`));
