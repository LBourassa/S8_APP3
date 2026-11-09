# SAQLICPO — démarrage (boîte noire)

Prérequis : **Docker Desktop** installé et démarré.

1. Charger l'image fournie (dans ce dossier) :
   ```bash
   docker load -i saqlicpo-app3.tar
   ```
2. Démarrer :
   ```bash
   docker compose up
   ```
3. Portail : http://localhost:3000

Arrêt : `Ctrl+C` puis `docker compose down`.

## Comptes de démonstration

| Utilisateur | Mot de passe           | Rôle    |
| ----------- | ---------------------- | ------- |
| `mcote`     | `jaimeprendreunbain67` | employe |
| `jroy`      | `patrickroycleking33`  | employe |

Les employés se connectent et téléversent des documents.
