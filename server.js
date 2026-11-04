const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const { dechiffrer, SECRET } = require('./crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

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

// --- Journalisation applicative ---
const LOG_FILE = path.join(__dirname, 'logs', 'app.log');
function log(event, details) {
  const line = `${new Date().toISOString()} ${event}${details ? ' ' + details : ''}`;
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

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
  // ⚠️ VULN #5 — on DÉCHIFFRE le mot de passe stocké pour le comparer (au lieu
  // de comparer un hash). Tout détenteur de la clé peut donc retrouver le clair.
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

// --- Accueil : page de bienvenue (protégée) ---
app.get('/', requireLogin, (req, res) => res.render('home'));

// --- Tableau de bord : documents (protégé) ---
app.get('/documents', requireLogin, (req, res) => {
  res.render('dashboard', { documents: db.load('documents') });
});

// --- Téléversement : seules les factures .png sont acceptées ---
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

// Génère un aperçu du document : les fiches dynamiques exportent une fonction apercu().
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

    // Génère un aperçu du document téléversé.
    try {
      log('PROCESS', `document=${path.relative(__dirname, req.file.path)}`);
      genererApercu(req.file.path);
    } catch (e) {
      // aperçu indisponible pour ce fichier — ignoré
    }

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
// Contre-exemple « sécurisé » : on ne garde QUE le nom de base (path.basename)
// et on confine à PAIE_DIR, donc cette route N'est PAS traversable. La seule
// voie « propre » vers la paie est donc la prise du compte admin (chaîne #4→#5).
const PAIE_DIR = path.join(__dirname, 'data', 'paie');
app.get('/paie', requireLogin, requireAdmin, (req, res) => {
  const nom = path.basename(req.query.nom || 'fiche_paie_2026-11.csv'); // confiné
  const chemin = path.join(PAIE_DIR, nom);
  if (!chemin.startsWith(PAIE_DIR + path.sep)) return res.status(400).send('Chemin invalide');
  log('PAIE', `user=${req.session.user.username} nom="${nom}" ip=${req.ip}`);
  res.download(chemin, nom, (err) => {
    if (err && !res.headersSent) res.status(404).send('Fiche introuvable');
  });
});

// --- Téléchargement d'un document par son nom de fichier (tout employé) ---
// ⚠️ VULN #4 — PATH TRAVERSAL. Le nom vient de l'utilisateur (?nom=) et est
// concaténé au répertoire uploads/ SANS vérifier que le résultat y reste.
// path.join() résout les « ../ » et produit un chemin absolu normalisé :
// res.sendFile() ne voit alors plus aucun « .. » et sert le fichier hors de
// uploads/. Exemples :
//   /fichier?nom=../logs/app.log        → journaux (contiennent la clé, vuln #5)
//   /fichier?nom=../data/users.json     → mots de passe chiffrés
//   /fichier?nom=../../../../etc/passwd → fichiers système du conteneur
app.get('/fichier', requireLogin, (req, res) => {
  const nom = req.query.nom || '';
  const chemin = path.join(UPLOAD_DIR, nom); // aucun confinement
  log('FICHIER', `user=${req.session.user.username} nom="${nom}" ip=${req.ip}`);
  res.sendFile(chemin, (err) => {
    if (err && !res.headersSent) res.status(404).send('Fichier introuvable');
  });
});

// 404 pour toute autre route.
app.use((req, res) => res.status(404).send('Page introuvable'));

app.listen(PORT, () => {
  log('START', `port=${PORT}`);
  // ⚠️ VULN #5 — la clé de chiffrement est écrite en clair dans logs/app.log.
  // Un attaquant qui lit ce journal (p. ex. via la vuln #4) récupère la clé,
  // puis déchiffre tous les mots de passe de data/users.json.
  log('CRYPTO_INIT', `chargement cle de chiffrement APP_KEY=${SECRET}`);
  console.log(`SAQLICPO sur http://localhost:${PORT}`);
});
