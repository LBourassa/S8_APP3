# SAQLICPO — APP3 (S8)

Portail interne fictif : les employés téléversent des
documents, l'administrateur peut les télécharger. Application de base,
fonctionnelle.

## Démarrer (dev web)

```bash
npm install
npm run seed      # crée data/users.json (mots de passe hachés)
npm run dev       # démarre avec nodemon
```

Portail : http://localhost:3000

## Démarrer (conteneur)

```bash
docker compose up --build
```

Portail : http://localhost:3000

## Comptes de démonstration

| Utilisateur | Mot de passe    | Rôle    |
| ----------- | --------------- | ------- |
| `admin`     | `Admin#2026`    | admin   |
| `mcote`     | `jaimeprendreunbain67` | employe |
| `jroy`      | `patrickroycleking33`  | employe |

- Les employés se connectent et **téléversent** des documents.
- L'administrateur se connecte et peut **télécharger** les documents déposés.

## Structure

- `server.js` — portail Express (auth, upload, download)
- `db.js` + `data/` — « base » sous forme de fichiers JSON
- `views/` — pages EJS · `public/` — CSS · `uploads/` — fichiers téléversés
