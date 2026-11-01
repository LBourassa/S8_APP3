# SAQLICPO — APP3 (S8)

Portail interne fictif : les employés téléversent des
documents, l'administrateur peut les télécharger. Application de base,
fonctionnelle.

## Démarrer

```bash
npm install
npm run seed      # crée data/users.json (mots de passe hachés)
npm run dev       # démarre avec nodemon
```

Portail : http://localhost:3000

- Les employés se connectent et **téléversent** des documents.
- L'administrateur se connecte et peut **télécharger** les documents déposés.

## Structure

- `server.js` — portail Express (auth, upload, download)
- `db.js` + `data/` — « base » sous forme de fichiers JSON
- `views/` — pages EJS · `public/` — CSS · `uploads/` — fichiers téléversés
