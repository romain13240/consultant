#!/usr/bin/env bash
# ============================================================================
#  deploy-rpi.sh — Déploiement de l'étude « Consultant agent IA » sur Raspberry Pi
#  ---------------------------------------------------------------------------
#  Usage :
#     ./deploy-rpi.sh [options]
#     curl -fsSL https://raw.githubusercontent.com/romain13240/consultant/main/deploy-rpi.sh | bash -s -- [options]
#
#  Options (cumulables, aucune n'est obligatoire) :
#     --link         rattache le site au serveur statique du port 8080, sous
#                    /consultant/marcus, par lien symbolique (racine auto-détectée)
#     --drive        crée un venv, installe les dépendances Google et publie
#                    le classeur sur Drive
#     --no-service   n'installe pas le service systemd du port 8001
#     --port N       port du service systemd            (défaut 8001)
#     --root DIR     racine du serveur statique, si l'auto-détection échoue
#
#  Variables surchargeables : REPO_URL, APP_DIR, PORT
#
#  NOTE D'IMPLÉMENTATION — tout le corps est enfermé dans main().
#  Le script fait « git reset --hard » sur le répertoire d'où il s'exécute,
#  donc sur son propre fichier. Bash lit un script par morceaux au fil de
#  l'exécution : si le fichier change en cours de route, la suite est lue au
#  mauvais décalage. Enfermer le corps dans une fonction force bash à parser
#  jusqu'à l'accolade fermante avant de rien exécuter.
# ============================================================================
set -euo pipefail

main() {
  REPO_URL="${REPO_URL:-https://github.com/romain13240/consultant.git}"
  APP_DIR="${APP_DIR:-$HOME/consultant}"
  PORT="${PORT:-8001}"
  SERVICE="consultant"
  UNIT_DIR="$HOME/.config/systemd/user"
  VENV="$HOME/.venvs/consultant"

  FAIRE_LIEN=0
  FAIRE_DRIVE=0
  FAIRE_SERVICE=1
  RACINE_WEB=""

  while [ $# -gt 0 ]; do
    case "$1" in
      --link)       FAIRE_LIEN=1 ;;
      --drive)      FAIRE_DRIVE=1 ;;
      --no-service) FAIRE_SERVICE=0 ;;
      --port)       PORT="$2"; shift ;;
      --root)       RACINE_WEB="$2"; FAIRE_LIEN=1; shift ;;
      -h|--help)    sed -n '2,20p' "$0" 2>/dev/null || true; return 0 ;;
      *)            echo "Option inconnue : $1" >&2; return 2 ;;
    esac
    shift
  done

  log()  { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
  ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
  warn() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
  die()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

  command -v git >/dev/null 2>&1 || die "git requis : sudo apt install git"
  command -v python3 >/dev/null 2>&1 || die "python3 requis : sudo apt install python3"

  # ----------------------------------------------------------- 1. Sources
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
  chmod +x "$APP_DIR/deploy-rpi.sh" 2>/dev/null || true
  ok "Sources à jour ($(git -C "$APP_DIR" rev-parse --short HEAD))"

  # ------------------------------- 2. Rattachement au serveur statique 8080
  if [ "$FAIRE_LIEN" = "1" ]; then
    # Le serveur du 8080 peut tourner sous un autre compte : ni « ss -p » ni
    # /proc/<pid>/ ne sont alors lisibles, et l'auto-détection échouait en
    # silence. On repasse par sudo dans ce cas.
    SUDO=""
    [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && SUDO="sudo"

    if [ -z "$RACINE_WEB" ]; then
      log "Recherche de la racine du serveur du port 8080"
      # Le filtre « sport = :8080 » de ss reste muet sur certaines versions
      # d'iproute2 alors que la socket existe : on liste et on filtre nous-mêmes.
      PID8080="$(ss -tlnp 2>/dev/null | awk '$4 ~ /:8080$/' | grep -oP 'pid=\K[0-9]+' | head -1 || true)"
      if [ -z "$PID8080" ] && [ -n "$SUDO" ]; then
        echo "    (processus d'un autre compte — passage par sudo)"
        PID8080="$($SUDO ss -tlnp 2>/dev/null | awk '$4 ~ /:8080$/' | grep -oP 'pid=\K[0-9]+' | head -1 || true)"
      fi
      if [ -n "$PID8080" ]; then
        CMD8080="$(tr '\0' ' ' < "/proc/$PID8080/cmdline" 2>/dev/null \
                   || $SUDO tr '\0' ' ' < "/proc/$PID8080/cmdline" 2>/dev/null || true)"
        RACINE_WEB="$(printf '%s' "$CMD8080" | grep -oP '(?<=--directory )\S+' || true)"
        if [ -z "$RACINE_WEB" ]; then
          RACINE_WEB="$(readlink -f "/proc/$PID8080/cwd" 2>/dev/null \
                        || $SUDO readlink -f "/proc/$PID8080/cwd" 2>/dev/null || true)"
        fi
        echo "    pid      : $PID8080"
        echo "    commande : ${CMD8080:-inconnue}"
        echo "    racine   : ${RACINE_WEB:-non déterminée}"
      else
        warn "Aucun processus en écoute sur le port 8080."
      fi
    fi

    BASE_WEB="${RACINE_WEB:-}/consultant"
    CIBLE="$BASE_WEB/marcus"
    PUBLIC_DIR="$APP_DIR/web/consultant/marcus"
    if [ -z "$RACINE_WEB" ]; then
      warn "Racine du serveur 8080 non déterminée."
      warn "Relancez en la précisant :  ./deploy-rpi.sh --root /chemin/vers/la/racine"
    elif [ ! -d "$RACINE_WEB" ] || [ "$RACINE_WEB" = "/" ]; then
      warn "Racine inutilisable : « $RACINE_WEB » — lien non créé."
    elif [ "$(readlink -f "$PUBLIC_DIR")" = "$(readlink -f "$CIBLE" 2>/dev/null || echo /introuvable)" ]; then
      # Le dépôt est déjà à l'emplacement servi : un lien pointerait sur lui-même.
      ok "Le dépôt est déjà à l'emplacement servi : $CIBLE"
      LIEN_OK=1
    else
      [ -f "$PUBLIC_DIR/index.html" ] || die "Fichier web manquant : $PUBLIC_DIR/index.html"
      mkdir -p "$BASE_WEB" 2>/dev/null || $SUDO mkdir -p "$BASE_WEB" || true
      if ln -sfn "$PUBLIC_DIR" "$CIBLE" 2>/dev/null; then
        ok "Lien créé : $CIBLE -> $PUBLIC_DIR"
        LIEN_OK=1
      elif [ -n "$SUDO" ] && $SUDO ln -sfn "$PUBLIC_DIR" "$CIBLE"; then
        ok "Lien créé (sudo) : $CIBLE -> $PUBLIC_DIR"
        LIEN_OK=1
      else
        warn "Impossible de créer $CIBLE — droits insuffisants."
        warn "À faire manuellement :"
        warn "  sudo mkdir -p $BASE_WEB && sudo ln -sfn $PUBLIC_DIR $CIBLE"
      fi
    fi

    # Un lien correct ne suffit pas : si le serveur tourne sous un autre compte
    # et ne peut pas traverser le dépôt, il répond 404 — indiscernable d'un
    # chemin absent.
    if [ "${LIEN_OK:-0}" = "1" ]; then
      chmod o+rx "$APP_DIR" "$APP_DIR/web" "$APP_DIR/web/consultant" "$PUBLIC_DIR" 2>/dev/null || true
      chmod o+r "$PUBLIC_DIR/index.html" "$PUBLIC_DIR/index marcus.html" 2>/dev/null || true
      chmod o+rx "$BASE_WEB" 2>/dev/null || $SUDO chmod o+rx "$BASE_WEB" 2>/dev/null || true
    fi

    # Publie aussi la page Consultant comme fichier indépendant à la racine,
    # à côté de « index suivi patrimoine.html », sans remplacer celui-ci.
    CONSULTANT_FILE="$APP_DIR/web/consultant.html"
    ROOT_CONSULTANT="$RACINE_WEB/consultant.html"
    if [ -f "$CONSULTANT_FILE" ]; then
      if ln -sfn "$CONSULTANT_FILE" "$ROOT_CONSULTANT" 2>/dev/null; then
        ok "Fichier racine publié : $ROOT_CONSULTANT"
      elif [ -n "$SUDO" ] && $SUDO ln -sfn "$CONSULTANT_FILE" "$ROOT_CONSULTANT"; then
        ok "Fichier racine publié (sudo) : $ROOT_CONSULTANT"
      else
        warn "Impossible de publier $ROOT_CONSULTANT — droits insuffisants."
        warn "À faire manuellement : sudo ln -sfn '$CONSULTANT_FILE' '$ROOT_CONSULTANT'"
      fi
    fi
  fi

  # --------------------------------------------- 3. Service utilisateur 8001
  if [ "$FAIRE_SERVICE" = "1" ]; then
    # Le port peut déjà être servi par le même service lancé sous un AUTRE
    # compte utilisateur : dans ce cas systemd échouerait sur « Address already
    # in use », sans que ce soit une erreur de déploiement.
    OCCUPE=0
    if ss -tlnH "sport = :$PORT" 2>/dev/null | grep -q .; then
      systemctl --user is-active --quiet "$SERVICE" 2>/dev/null || OCCUPE=1
    fi
    if [ "$OCCUPE" = "1" ]; then
      warn "Port $PORT déjà occupé par un autre processus — service non installé."
      warn "Le site reste accessible par le lien ci-dessus, ou utilisez --port N."
      FAIRE_SERVICE=0
    else
      log "Installation du service utilisateur « $SERVICE » (port $PORT)"
      mkdir -p "$UNIT_DIR"
      [ -f "$APP_DIR/consultant.service" ] || die "consultant.service introuvable"
      sed -e "s|8001|$PORT|g" -e "s|%h/consultant|$APP_DIR|g" \
          "$APP_DIR/consultant.service" > "$UNIT_DIR/$SERVICE.service"
      systemctl --user daemon-reload
      systemctl --user enable "$SERVICE" >/dev/null 2>&1 || true
      systemctl --user restart "$SERVICE"
      sleep 1
      systemctl --user is-active --quiet "$SERVICE" \
        || die "Le service n'a pas démarré : systemctl --user status $SERVICE"
      ok "Service actif"
      if command -v loginctl >/dev/null 2>&1; then
        if ! loginctl show-user "$(id -un)" -p Linger 2>/dev/null | grep -q "Linger=yes"; then
          warn "Le service s'arrêtera à la déconnexion. Pour le rendre permanent :"
          echo "      sudo loginctl enable-linger $(id -un)"
        fi
      fi
    fi
  fi

  # ------------------------------------------- 4. Publication Google Drive
  # Raspberry Pi OS applique PEP 668 : pip refuse d'installer dans le système.
  if [ "$FAIRE_DRIVE" = "1" ]; then
    if [ ! -x "$VENV/bin/python" ]; then
      log "Création de l'environnement virtuel $VENV"
      python3 -m venv "$VENV" \
        || die "venv indisponible : sudo apt install -y python3-venv puis relancer"
    fi
    log "Installation des dépendances Google (une minute au premier passage)"
    "$VENV/bin/pip" install --quiet --upgrade pip >/dev/null 2>&1 || true
    "$VENV/bin/pip" install --quiet google-api-python-client google-auth openpyxl \
      || die "Échec de l'installation des dépendances Google"
    ok "Environnement Drive prêt"
    echo
    log "Publication du classeur sur Google Drive"
    "$VENV/bin/python" "$APP_DIR/sheets/push_to_drive.py" \
      || warn "Publication Drive non aboutie — voir le message ci-dessus"
  fi

  # ---------------------------------------------------------- 5. Résultat
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo
  ok "Déploiement terminé — $APP_DIR"
  [ "${LIEN_OK:-0}" = "1" ] && echo "   Via 8080 : http://${IP:-localhost}:8080/consultant/marcus/"
  [ "$FAIRE_SERVICE" = "1" ] && echo "   Service  : http://${IP:-localhost}:$PORT"
  echo
  echo "   Mise à jour   : relancer ce script avec les mêmes options"
  [ "$FAIRE_SERVICE" = "1" ] && echo "   Journal       : journalctl --user -u $SERVICE -f"
  if [ -x "$VENV/bin/python" ]; then
    echo "   Google Sheets : $VENV/bin/python $APP_DIR/sheets/push_to_drive.py"
  else
    echo "   Google Sheets : ./deploy-rpi.sh --drive"
  fi
  return 0
}

# Appel et sortie sur une seule ligne : bash a déjà lu ce qu'il doit exécuter
# avant que main() ne réécrive le fichier sous ses pieds.
main "$@"; exit $?
