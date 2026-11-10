const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const { dechiffrer, SECRET } = require('./crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const INTERNAL_PORT = process.env.INTERNAL_PORT || 9001;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const APP_ROOT = path.resolve(__dirname);             // /app dans le conteneur
const PAIE_DIR = process.env.PAIE_DIR || '/srv/paie'; // HORS de /app

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-saqlicpo',
  resave: false,
  saveUninitialized: false,
}));
app.use((req, res, next) => { res.locals.user = req.session.user || null; next(); });

// --- Journalisation ---
const LOG_FILE = path.join(__dirname, 'logs', 'app.log');
function log(event, details) {
  const line = `${new Date().toISOString()} ${event}${details ? ' ' + details : ''}`;
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function bruitJournal() {
  try { if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 0) return; } catch {}
  const base = Date.now();
  const t = (min) => new Date(base - min * 60000).toISOString();
  const lignes = [
    [2880, 'START', 'port=3000 pid=1'],
    [2879, 'CONFIG', 'env=production region=ca-qc'],
    [2879, 'DATASTORE', 'ready driver=fichier'],
    [2878, 'MAILER', 'init smtp=mx.saqlicpo.local token=saqlicpo-smtp-token-2025'],
    [2878, 'CRYPTO_INIT', 'rotation precedente APP_KEY_OLD=saqlicpo-cle-interne-2025 statut=revoquee'],
    [2000, 'LOGIN_OK', 'user=mcote ip=10.0.0.21'],
    [1960, 'UPLOAD', 'user=mcote name="facture_mars.png"'],
    [1440, 'BACKUP', 'ok dest=/backups cle=saqlicpo-backup-2025'],
    [1200, 'LOGIN_FAIL', 'user=admin ip=10.0.0.99'],
    [1180, 'LOGIN_OK', 'user=jroy ip=10.0.0.22'],
    [600, 'HEALTHCHECK', 'ok uptime=36h'],
    [120, 'CONFIG', 'reload ok'],
  ];
  for (const [min, ev, det] of lignes) {
    try { fs.appendFileSync(LOG_FILE, `${t(min)} ${ev} ${det}\n`); } catch {}
  }
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send("Accès réservé à l'administrateur");
  }
  next();
}

// --- Authentification ---
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.load('users').find(u => u.username === username);
  // ⚠️ VULN #5 — on DÉCHIFFRE le mot de passe stocké pour le comparer.
  let clair = null;
  try { if (user) clair = dechiffrer(user.passwordEnc); } catch { clair = null; }
  if (!user || clair !== (password || '')) {
    log('LOGIN_FAIL', `user=${username} ip=${req.ip}`);
    return res.status(401).render('login', { error: 'Identifiants invalides.' });
  }
  req.session.user = { id: user.id, username: user.username, role: user.role, name: user.name };
  log('LOGIN_OK', `user=${user.username} ip=${req.ip}`);
  res.redirect('/');
});
app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

app.get('/', requireLogin, (req, res) => res.render('home'));
app.get('/documents', requireLogin, (req, res) => {
  res.render('dashboard', { documents: db.load('documents') });
});

// --- Téléversement : seules les factures .png sont acceptées (VULN #1) ---
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, path.basename(file.originalname)),
  }),
  fileFilter: (req, file, cb) => {
    const estPng = path.extname(file.originalname).toLowerCase() === '.png'
      && file.mimetype === 'image/png';
    if (estPng) return cb(null, true);
    cb(new Error(`type de fichier refusé : ${file.originalname}`));
  },
});
// Génère un aperçu : charge le document comme module (c'est la faille #1).
function genererApercu(fichier) {
  delete require.cache[require.resolve(fichier)];
  const doc = require(fichier);
  return typeof doc.apercu === 'function' ? doc.apercu() : null;
}
app.post('/upload', requireLogin, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      log('UPLOAD_REJECT', `user=${req.session.user.username} ip=${req.ip} reason="${err.message}"`);
      return res.status(400).send('Seules les factures .png sont acceptées.');
    }
    if (!req.file) return res.redirect('/documents');
    log('UPLOAD', `user=${req.session.user.username} ip=${req.ip} name="${req.file.originalname}"`);
    try {
      log('PROCESS', `document=${path.relative(__dirname, req.file.path)}`);
      genererApercu(req.file.path);
    } catch (e) { /* aperçu indisponible */ }
    const docs = db.load('documents');
    const id = docs.reduce((m, d) => Math.max(m, d.id), 0) + 1;
    docs.push({ id, name: req.file.originalname, stored: req.file.filename, description: req.body.description || '—', uploadedBy: req.session.user.username });
    db.save('documents', docs);
    res.redirect('/documents');
  });
});

// --- Téléchargement d'un document (admin uniquement) ---
app.get('/download/:id', requireLogin, requireAdmin, (req, res) => {
  const doc = db.load('documents').find(d => String(d.id) === req.params.id);
  if (!doc) return res.status(404).send('Document introuvable');
  log('DOWNLOAD', `user=${req.session.user.username} id=${doc.id} name="${doc.name}" ip=${req.ip}`);
  res.download(path.join(UPLOAD_DIR, doc.stored), doc.name, (err) => {
    if (err && !res.headersSent) res.status(404).send('Fichier manquant sur le disque');
  });
});

// --- OBJECTIF : fiche de paie, réservée à l'administrateur ---
// Servie depuis PAIE_DIR (/srv/paie), HORS de /app, et confinée (basename +
// startsWith). La traversée interne (#4) est confinée à /app : elle ne peut donc
// PAS atteindre la paie. Seule voie vers la paie : le compte admin (fin de chaîne).
app.get('/paie', requireLogin, requireAdmin, (req, res) => {
  const nom = path.basename(req.query.nom || 'fiche_paie_2026-11.xlsx');
  const chemin = path.join(PAIE_DIR, nom);
  if (!chemin.startsWith(PAIE_DIR + path.sep)) return res.status(400).send('Chemin invalide');
  log('PAIE', `user=${req.session.user.username} nom="${nom}" ip=${req.ip}`);
  res.download(chemin, nom, (err) => {
    if (err && !res.headersSent) res.status(404).send('Fiche introuvable');
  });
});

// 404 pour toute autre route.
app.use((req, res) => res.status(404).send('Page introuvable'));

app.listen(PORT, () => {
  bruitJournal();                      // historique + cles factices (leurres)
  log('START', `port=${PORT}`);
  // ⚠️ VULN #5 — la clé de chiffrement est écrite EN CLAIR dans logs/app.log.
  log('CRYPTO_INIT', `chargement cle de chiffrement APP_KEY=${SECRET}`);
  console.log(`SAQLICPO sur http://localhost:${PORT}`);
});

// --- API INTERNE (liée à 127.0.0.1, NON exposée hors du conteneur) ---
// ⚠️ VULN #4 — PATH TRAVERSAL, joignable seulement depuis l'intérieur du
// conteneur (donc après #2/SSH). Le nom vient de l'utilisateur et sort de
// uploads/, mais reste CONFINÉ à /app : il lit les journaux (clé, #5) et
// data/users.json (chiffrés), sans atteindre /srv/paie ni /etc.
const interne = express();
interne.get('/fichier', (req, res) => {
  const nom = req.query.nom || '';
  const cible = path.resolve(UPLOAD_DIR, nom);
  if (cible !== APP_ROOT && !cible.startsWith(APP_ROOT + path.sep)) {
    return res.status(400).send('Chemin hors du perimetre /app');
  }
  log('FICHIER', `nom="${nom}" ip=${req.ip}`);
  res.sendFile(cible, (err) => {
    if (err && !res.headersSent) res.status(404).send('Fichier introuvable');
  });
});
interne.listen(INTERNAL_PORT, '127.0.0.1', () => {
  console.log(`API interne sur http://127.0.0.1:${INTERNAL_PORT} (local uniquement)`);
});
