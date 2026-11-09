# Image de l'exercice SAQLICPO : app Node + serveur SSH, dans un conteneur Linux.
FROM node:20-bookworm-slim

# --- Serveur SSH : authentification par CLÉ PUBLIQUE uniquement ---
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssh-server \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /run/sshd \
 && sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config \
 && sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config \
 && sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config \
 && ssh-keygen -A

# --- Utilisateur applicatif non-root : l'app tourne sous lui (donc #1 != root) ---
RUN useradd -m -s /bin/bash appuser

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

# La fiche de paie est déplacée HORS de /app (/srv/paie) : la traversée #4,
# confinée à /app, ne peut pas l'atteindre. Prépare aussi le ~/.ssh de appuser.
RUN mkdir -p /srv \
 && mv /app/paie /srv/paie \
 && chown -R appuser:appuser /app /srv/paie \
 && install -d -o appuser -g appuser -m 700 /home/appuser/.ssh

EXPOSE 3000 22
COPY docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
