// EXERCICE 2 — Traversee de repertoire.  Lance :  node exercice2.js
const path = require('path');
const BASE = path.join(__dirname, 'fichiers');

// ---- TODO (2c) : complete cette fonction, puis relance le script ----
// Indice : path.resolve(base, nom), puis compare a  base + path.sep.
function estSur(base, nom) {
  // ... remplace la ligne ci-dessous par ta verification
  return false;
}
// --------------------------------------------------------------------

console.log('===== (a) path.join RESOUT les ../ =====');
console.log('join  note.txt      ->', path.join(BASE, 'note.txt'));
console.log('join  ../secret.txt ->', path.join(BASE, '../secret.txt'),
            '  <- le ".." a disparu, on est SORTI de fichiers/');
console.log('join(/a,/b)    ->', path.join('/a', '/b'),
            '   | resolve(/a,/b) ->', path.resolve('/a', '/b'),
            '  <- resolve remet a zero sur un argument absolu');

console.log('\n===== (b) pourquoi res.sendFile ne protege plus =====');
const nom = '../../etc/passwd';
console.log('nom fourni :', nom);
console.log('apres join :', path.join(BASE, nom),
            '  <- AUCUN ".." restant : la protection n\'a rien a bloquer');
console.log('(le nombre de ../ depend de la profondeur du dossier servi)');

console.log('\n===== (c) confinement — complete le TODO en haut =====');
console.log('note.txt      ->', estSur(BASE, 'note.txt'),      '  (attendu: true une fois le TODO fait)');
console.log('../secret.txt ->', estSur(BASE, '../secret.txt'), '  (attendu: false)');
console.log('basename(../../etc/passwd) =', path.basename('../../etc/passwd'),
            '  <- ne garde que le nom final');
