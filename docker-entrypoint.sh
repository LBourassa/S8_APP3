#!/bin/sh
set -e

# Serveur SSH (démarré en root).
/usr/sbin/sshd

# Base de données puis application, sous l'utilisateur NON-root appuser.
# (su conserve les variables d'environnement, dont APP_KEY.)
exec su appuser -c "cd /app && node seed.js && node server.js"
