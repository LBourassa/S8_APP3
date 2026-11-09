// Génère data/users.json. Lancé automatiquement au démarrage du conteneur.
//
// ⚠️  VULN #5 (volet 2/2) — les mots de passe sont stockés CHIFFRÉS (réversibles),
// pas hachés. Combinés à la clé qui fuite dans logs/app.log, ils sont
// entièrement récupérables en clair. Aucun mot de passe n'apparaît ici en clair :
// seules les valeurs déjà chiffrées (AES-256-CBC, format iv:cipher) sont présentes.
const fs = require('fs');
const path = require('path');

const users = [
  { id: 1, username: 'admin', name: 'Admin',      role: 'admin',   passwordEnc: 'ccd115eabbea82ef629e3959a43d4cc2:1a08243e9c54cc5fa7657cf6d0e13678' },
  { id: 2, username: 'mcote', name: 'Marie Côté', role: 'employe', passwordEnc: '553d33a50293a593fdf3d850ed8f9971:f70ebf9ed3bbf4c144de1fccb01d1066e0942b0b58a755f5ed9ba959d2223baf' },
  { id: 3, username: 'jroy',  name: 'Jean Roy',   role: 'employe', passwordEnc: '17331a948976204aefc91c416a636e8b:e593aa6fc63c945119614115899faa908d75cf582d0dccb163a3692600d3c706' },
];

fs.writeFileSync(path.join(__dirname, 'data', 'users.json'), JSON.stringify(users, null, 2));
console.log(`Seed : data/users.json créé (${users.length} utilisateurs, mots de passe chiffrés).`);
