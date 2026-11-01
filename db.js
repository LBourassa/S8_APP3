// Mini-couche de données : des fichiers JSON dans data/ jouent le rôle de « base ».
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'data');
const file = (name) => path.join(DIR, name + '.json');

// Lecture tolérante : un fichier absent = liste vide (l'app démarre même avant
// `npm run seed`). Un JSON corrompu lève volontairement, pour ne pas masquer un dégât.
function load(name) {
  const f = file(name);
  if (!fs.existsSync(f)) return [];
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function save(name, data) {
  fs.writeFileSync(file(name), JSON.stringify(data, null, 2));
}

module.exports = { load, save };
