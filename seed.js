// Génère data/users.json. Lancer : npm run seed
//
// ⚠️  VULN #5 (volet 2/2) — les mots de passe sont CHIFFRÉS (réversibles),
// pas hachés. Combinés à la clé qui fuite dans logs/app.log, ils sont
// entièrement récupérables en clair.
const fs = require('fs');
const path = require('path');
const { chiffrer } = require('./crypto');

const seed = [
  { id: 1, username: 'admin', name: 'Admin', role: 'admin',   password: 'Admin#2026' },
  { id: 2, username: 'mcote', name: 'Marie Côté',    role: 'employe', password: 'jaimeprendreunbain67' },
  { id: 3, username: 'jroy',  name: 'Jean Roy',      role: 'employe', password: 'patrickroycleking33' },
];

const users = seed.map(u => ({
  id: u.id, username: u.username, name: u.name, role: u.role,
  passwordEnc: chiffrer(u.password),
}));

fs.writeFileSync(path.join(__dirname, 'data', 'users.json'), JSON.stringify(users, null, 2));
console.log(`Seed : data/users.json créé (${users.length} utilisateurs, mots de passe chiffrés).`);
