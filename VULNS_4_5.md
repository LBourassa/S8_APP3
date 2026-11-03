# SAQLICPO — Vulnérabilités #4 et #5 (notes pour le guide APP)

Document interne (équipe responsable). Décrit les deux vulnérabilités ajoutées,
le scénario d'exploitation attendu et les correctifs, pour animer le tutorat /
la validation de l'APP gigogne.

---

## Vuln #4 — Path Traversal sur le téléchargement

**Où :** route `GET /fichier?nom=...` dans `server.js`.
Fonctionnalité légitime : un employé connecté télécharge un document par son nom
(lien « Télécharger » du tableau de bord).

**Faille :** le nom vient de l'utilisateur et est concaténé au répertoire
`uploads/` sans vérifier que le résultat y reste :

```js
const chemin = path.join(UPLOAD_DIR, nom);   // aucun confinement
res.sendFile(chemin, ...);
```

`path.join` **résout** les `../` et produit un chemin absolu normalisé, sans
aucun `..` résiduel. La protection intégrée de `res.sendFile` (qui refuse les
`..`) ne voit donc plus rien à bloquer, et sert un fichier hors de `uploads/`.

**Charges utiles (depuis une session employé) :**

| Objectif | Requête |
| --- | --- |
| Journaux (clé, vuln #5) | `/fichier?nom=../logs/app.log` |
| Base des comptes | `/fichier?nom=../data/users.json` |
| Fichiers système | `/fichier?nom=../../etc/passwd` |

> Depuis le conteneur Docker, l'app est dans `/app`, donc `uploads/` = `/app/uploads`
> et `../../etc/passwd` atteint bien `/etc/passwd`.

**Correctif attendu (validation) :** résoudre le chemin puis vérifier qu'il
reste dans le répertoire autorisé, p. ex. :

```js
const base = path.resolve(UPLOAD_DIR);
const cible = path.resolve(base, path.basename(nom)); // ou resolve + startsWith
if (!cible.startsWith(base + path.sep)) return res.status(400).send('Chemin invalide');
```

La route `GET /paie` montre la version **confinée** (basename + `startsWith`) :
elle sert de contre-exemple correct.

---

## Vuln #5 — Mots de passe chiffrés (réversibles) + clé fuitée dans les logs

**Où :** `crypto.js`, `seed.js`, et la journalisation dans `server.js`.

**Faille, en deux temps :**

1. Les mots de passe sont **chiffrés** (AES-256-CBC, réversible) au lieu d'être
   *hachés* (bcrypt). Stockés dans `data/users.json` sous `passwordEnc`. Le
   serveur peut donc retrouver le mot de passe en clair — ce qu'un serveur ne
   devrait jamais avoir besoin de faire.
2. La **clé** de chiffrement est écrite en clair dans `logs/app.log` au
   démarrage :

   ```
   CRYPTO_INIT chargement cle de chiffrement APP_KEY=saqlicpo-cle-interne-2026
   ```

Qui lit le journal obtient la clé, et qui a la clé déchiffre tous les mots de
passe.

**Correctif attendu (validation) :**
- hacher les mots de passe (bcrypt/argon2), jamais les chiffrer ;
- ne jamais journaliser de secret (clé, mot de passe, jeton) ;
- gérer les secrets hors du code et hors des journaux.

---

## Scénario complet (chaîne #4 → #5 → objectif)

Point de départ : une session **employé** (p. ex. `mcote`). Objectif : récupérer
la **fiche de paie**, réservée à l'administrateur (`GET /paie`, protégé par
`requireAdmin`).

1. **#4** `GET /fichier?nom=../logs/app.log` → lire `APP_KEY=...` (la clé).
2. **#4** `GET /fichier?nom=../data/users.json` → récupérer le `passwordEnc` de `admin`.
3. **#5** déchiffrer `passwordEnc` avec la clé (AES-256-CBC) → mot de passe admin en clair.
4. Se connecter : `POST /login` (username=`admin`) → session administrateur.
5. **Objectif** `GET /paie` → la fiche de paie.

Déchiffrement (reproductible) :

```js
const crypto = require('crypto');
function dechiffrer(paquet, secret) {
  const KEY = crypto.createHash('sha256').update(secret).digest();
  const [ivHex, dataHex] = paquet.split(':');
  const d = crypto.createDecipheriv('aes-256-cbc', KEY, Buffer.from(ivHex, 'hex'));
  return Buffer.concat([d.update(Buffer.from(dataHex, 'hex')), d.final()]).toString('utf8');
}
```

> Remarque de discussion : une fois la **#4** acquise (lecture de fichier
> arbitraire), la fiche de paie est aussi lisible directement sur le disque si on
> connaît son chemin. C'est un bon point de débat pendant le tutorat : un
> arbitrary-file-read compromet tout ce qui est sur le disque, pas seulement ce
> qui était « visé ».

---

## Rappel : appliquer les changements

Après avoir remplacé les fichiers, **re-générer la base** (les mots de passe
passent de `passwordHash` à `passwordEnc`) :

```bash
npm run seed          # régénère data/users.json (chiffré)
docker compose up --build
```
