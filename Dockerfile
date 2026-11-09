# Image de l'exercice SAQLICPO : app Node + serveur SSH, dans un conteneur Linux.
FROM node:20-bookworm-slim

# --- Serveur SSH : authentification par CLÉ PUBLIQUE uniquement ---
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssh-server curl \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /run/sshd \
 && sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config \
 && sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config \
 && sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config \
 && sed -i 's/^#*StrictModes.*/StrictModes no/' /etc/ssh/sshd_config \
 && ssh-keygen -A

# --- Deux utilisateurs distincts ---
#   appuser : fait tourner l'app (c'est son identité qu'on obtient via le RCE #1).
#   invite  : l'utilisateur SUR LEQUEL on atterrit en SSH (#2). Il ne possède RIEN
#             de l'app : il ne peut donc PAS lire /app ni /srv/paie en direct (cat),
#             seulement passer par l'API interne #4 (curl 127.0.0.1:9001).
RUN useradd -m -s /bin/bash appuser \
 && useradd -m -s /bin/bash invite

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

# Génère data/users.json (mots de passe chiffrés) AU BUILD, puis retire seed.js de
# l'image : dans le conteneur, le chiffré n'existe plus que dans data/users.json
# (la cible de l'étape #4), jamais dans un fichier seed.
RUN node seed.js && rm -f seed.js

# La fiche de paie (.xlsx protégé par mot de passe admin) est déplacée HORS de /app.
# /app et /srv/paie appartiennent à appuser et sont fermés aux AUTRES (o-rwx) : le
# shell `invite` ne peut donc ni entrer dans /app ni cat users.json/app.log/la paie.
# Il doit passer par l'API interne #4. Le ~/.ssh de `invite` appartient à appuser
# pour que le payload #1 (qui s'exécute SOUS appuser) puisse y planter la clé.
RUN mkdir -p /srv/paie \
 && mv /app/fiche_paie_2026-11.xlsx /srv/paie/fiche_paie_2026-11.xlsx \
 && chown -R appuser:appuser /app /srv/paie \
 && chmod -R o-rwx /app /srv/paie \
 && install -d -o appuser -g appuser -m 700 /home/invite/.ssh

EXPOSE 3000 22
COPY docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
