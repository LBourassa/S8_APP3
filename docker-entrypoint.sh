#!/bin/sh
set -e

# Clé de chiffrement interne de l'application (chargée au démarrage).
export APP_KEY=saqlicpo-cle-interne-2026

# Serveur SSH (démarré en root).
/usr/sbin/sshd

# Application, sous l'utilisateur NON-root appuser.
# (su conserve les variables d'environnement, dont APP_KEY.)
exec su appuser -c "cd /app && node server.js"
