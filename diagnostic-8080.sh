#!/usr/bin/env bash
# ============================================================================
#  diagnostic-8080.sh — Identifier le serveur qui occupe le port 8080.
#  ---------------------------------------------------------------------------
#  Le rattachement par lien symbolique suppose un serveur de fichiers statique.
#  Si le port est tenu par une application avec son propre routage, un lien
#  dans un dossier n'a aucun effet : c'est le code de l'application qui décide.
#  Ce script tranche entre les deux cas.
#
#  Usage :  bash diagnostic-8080.sh
# ============================================================================
set -uo pipefail
PORT="${1:-8080}"
SUDO=""; [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && SUDO="sudo"

echo "=== 1. Qui écoute sur $PORT ==="
$SUDO ss -tlnp 2>/dev/null | awk -v p=":$PORT\$" 'NR==1 || $4 ~ p'
PID="$($SUDO ss -tlnp 2>/dev/null | awk -v p=":$PORT\$" '$4 ~ p' | grep -oP 'pid=\K[0-9]+' | head -1)"
if [ -z "$PID" ]; then
  echo "Aucun processus identifié. Rien d'autre à dire."
  exit 1
fi

echo
echo "=== 2. Le processus $PID ==="
echo "utilisateur : $($SUDO ps -o user= -p "$PID" 2>/dev/null)"
echo "commande    : $($SUDO tr '\0' ' ' < "/proc/$PID/cmdline" 2>/dev/null)"
echo "exécutable  : $($SUDO readlink -f "/proc/$PID/exe" 2>/dev/null)"
echo "dossier     : $($SUDO readlink -f "/proc/$PID/cwd" 2>/dev/null)"

echo
echo "=== 3. Nature du serveur ==="
CODE_HEAD="$(curl -s -o /dev/null -w '%{http_code}' -I "http://localhost:$PORT/" 2>/dev/null)"
CODE_GET="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/" 2>/dev/null)"
echo "HEAD /  -> $CODE_HEAD"
echo "GET  /  -> $CODE_GET"
if [ "$CODE_HEAD" = "501" ]; then
  echo "→ HEAD non géré : application avec routage propre, PAS un serveur de fichiers."
  echo "  Un lien symbolique n'y changera rien ; il faut ajouter une route dans son code,"
  echo "  ou servir l'étude sur un autre port."
else
  echo "→ HEAD géré : serveur de fichiers statique, le rattachement par lien est jouable."
fi

echo
echo "=== 4. Ce que renvoie la racine (30 premières lignes) ==="
curl -s "http://localhost:$PORT/" 2>/dev/null | head -30

echo
echo "=== 5. Chemins déjà servis ==="
for p in / /consultant/ /consultant/marcus/ /index.html; do
  printf '  %-22s -> %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT$p" 2>/dev/null)"
done
