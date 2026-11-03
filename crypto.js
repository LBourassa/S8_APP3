// Chiffrement réversible des mots de passe (AES-256-CBC).
//
// ⚠️  VULN #5 (volet 1/2) — CHOIX DE CONCEPTION VOLONTAIREMENT FAIBLE.
// Dans une vraie application, un mot de passe ne se *chiffre* jamais : on le
// *hache* (bcrypt/argon2), car le serveur n'a aucun besoin de retrouver le mot
// de passe en clair. Ici on le chiffre — donc la connaissance de la clé suffit
// à tout déchiffrer. La clé, elle, fuite dans les journaux (voir server.js).
const crypto = require('crypto');

// Clé de 32 octets dérivée d'un secret. En clair dans l'environnement, et
// recopiée telle quelle dans logs/app.log au démarrage : c'est la fuite.
const SECRET = process.env.APP_KEY || 'saqlicpo-cle-interne-2026';
const KEY = crypto.createHash('sha256').update(SECRET).digest(); // 32 octets
const IV_LEN = 16;

function chiffrer(texte) {
  const iv = crypto.randomBytes(IV_LEN);
  const c = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  const enc = Buffer.concat([c.update(String(texte), 'utf8'), c.final()]);
  // Format stocké : iv_hex:ciphertext_hex
  return iv.toString('hex') + ':' + enc.toString('hex');
}

function dechiffrer(paquet) {
  const [ivHex, dataHex] = String(paquet).split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const d = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
  const dec = Buffer.concat([d.update(Buffer.from(dataHex, 'hex')), d.final()]);
  return dec.toString('utf8');
}

module.exports = { chiffrer, dechiffrer, SECRET };
