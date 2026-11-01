// Génère data/users.json avec des mots de passe hachés (bcrypt). Lancer : npm run seed
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const seed = [
  { id: 1, username: 'admin', name: 'Admin', role: 'admin',   password: 'Admin#2026' },
  { id: 2, username: 'mcote', name: 'Marie Côté',    role: 'employe', password: 'jaimeprendreunbain67' },
  { id: 3, username: 'jroy',  name: 'Jean Roy',      role: 'employe', password: 'patrickroycleking33' },
];

const users = seed.map(u => ({
  id: u.id, username: u.username, name: u.name, role: u.role,
  passwordHash: bcrypt.hashSync(u.password, 10),
}));

fs.writeFileSync(path.join(__dirname, 'data', 'users.json'), JSON.stringify(users, null, 2));
console.log(`Seed : data/users.json créé (${users.length} utilisateurs).`);
