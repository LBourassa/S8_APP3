// Chiffrement des mots de passe (AES-256-CBC).
const crypto = require('crypto');

const SECRET = process.env.APP_KEY;
if (!SECRET) {
  throw new Error("APP_KEY manquante : définir la variable d'environnement APP_KEY.");
}
const KEY = crypto.createHash('sha256').update(SECRET).digest(); // 32 octets
const IV_LEN = 16;

function chiffrer(texte) {
  const iv = crypto.randomBytes(IV_LEN);
  const c = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  const enc = Buffer.concat([c.update(String(texte), 'utf8'), c.final()]);
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
