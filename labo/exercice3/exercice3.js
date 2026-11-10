// EXERCICE 3 — Chiffrer vs hacher.  Lance :  node exercice3.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');

console.log('===== (a) AES : REVERSIBLE =====');
const KEY = crypto.createHash('sha256').update('ma-cle').digest();
const iv  = crypto.randomBytes(16);
const c   = crypto.createCipheriv('aes-256-cbc', KEY, iv);
const enc = Buffer.concat([c.update('motdepasse123', 'utf8'), c.final()]);
const d   = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
console.log('chiffre   :', enc.toString('hex'));
console.log('dechiffre :', Buffer.concat([d.update(enc), d.final()]).toString(),
            '  <- on RETROUVE l\'original (reversible)');

console.log('\n===== bcrypt : A SENS UNIQUE =====');
(async () => {
  const hash = await bcrypt.hash('motdepasse123', 10);
  console.log('hash          :', hash, '  <- impossible de revenir au clair');
  console.log('compare bon   :', await bcrypt.compare('motdepasse123', hash), '  (true)');
  console.log('compare faux  :', await bcrypt.compare('autre', hash),         '  (false)');
  console.log('=> on ne "dehache" jamais : on hache l\'entree et on COMPARE.');
})();
