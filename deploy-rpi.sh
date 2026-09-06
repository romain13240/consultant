#!/usr/bin/env bash
# ============================================================================
#  deploy-rpi.sh — Déploiement de l'étude « Consultant agent IA » sur Raspberry Pi
#  ---------------------------------------------------------------------------
#  Met à jour le déploiement existant : ~/consultant, servi sur le port 8001
#  par le service utilisateur systemd « consultant » (cf. consultant.service).
#
#  Usage sur le Pi :
#     curl -fsSL https://raw.githubusercontent.com/romain13240/consultant/main/deploy-rpi.sh | bash
#  ou, si le dépôt est déjà cloné :
#     cd ~/consultant && ./deploy-rpi.sh
#
#  Variables surchargeables :
#     REPO_URL   dépôt git source
#     APP_DIR    répertoire d'installation   (défaut ~/consultant)
#     PORT       port d'écoute               (défaut 8001)
# ============================================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/romain13240/consultant.git}"
APP_DIR="${APP_DIR:-$HOME/consultant}"
PORT="${PORT:-8001}"
SERVICE="consultant"
UNIT_DIR="$HOME/.config/systemd/user"

log()  { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || die "git requis : sudo apt install git"
command -v python3 >/dev/null 2>&1 || die "python3 requis : sudo apt install python3"

# ------------------------------------------------------------- 1. Sources
if [ -d "$APP_DIR/.git" ]; then
  log "Mise à jour du dépôt dans $APP_DIR"
  git -C "$APP_DIR" fetch --quiet origin
  git -C "$APP_DIR" reset --hard --quiet origin/main
else
  log "Clonage de $REPO_URL vers $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --quiet "$REPO_URL" "$APP_DIR"
fi
[ -f "$APP_DIR/index.html" ] || die "index.html introuvable dans $APP_DIR"
[ -f "$APP_DIR/assets/app.js" ] || die "assets/ manquant — dépôt incomplet"
ok "Sources à jour ($(git -C "$APP_DIR" rev-parse --short HEAD))"

# ------------------------------------------------- 2. Service utilisateur
log "Installation du service utilisateur « $SERVICE » (port $PORT)"
mkdir -p "$UNIT_DIR"
sed -e "s|8001|$PORT|g" "$APP_DIR/consultant.service" > "$UNIT_DIR/$SERVICE.service"

systemctl --user daemon-reload
systemctl --user enable "$SERVICE" >/dev/null 2>&1 || true
systemctl --user restart "$SERVICE"
sleep 1
systemctl --user is-active --quiet "$SERVICE" \
  || die "Le service n'a pas démarré : systemctl --user status $SERVICE"
ok "Service actif"

# Survivre à la déconnexion de la session
if command -v loginctl >/dev/null 2>&1; then
  if ! loginctl show-user "$(id -un)" -p Linger 2>/dev/null | grep -q "Linger=yes"; then
    warn "Le service s'arrêtera à la déconnexion. Pour le rendre permanent :"
    echo "      sudo loginctl enable-linger $(id -un)"
  fi
fi

# ------------------------------------------------------------ 3. Résultat
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
ok "Déploiement terminé"
echo "   Local  : http://localhost:$PORT"
[ -n "${IP:-}" ] && echo "   Réseau : http://$IP:$PORT"
echo
echo "   Mise à jour     : relancer ce script"
echo "   Journal         : journalctl --user -u $SERVICE -f"
echo "   Google Sheets   : python3 $APP_DIR/sheets/push_to_drive.py"
