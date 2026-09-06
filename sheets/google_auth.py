#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
google_auth.py — Localisation du jeton OAuth et construction des services Google.

Partagé par push_to_drive.py (classeur) et push_html_to_drive.py (page HTML),
pour que la recherche du jeton et ses messages d'erreur n'existent qu'à un
seul endroit.
"""

from __future__ import print_function

import errno
import json
import os
import sys

# Le jeton n'est pas au même endroit selon la machine et l'utilisateur : on
# essaie les emplacements connus plutôt que d'en coder un seul en dur.
CANDIDATS_JETON = [
    os.environ.get("GOOGLE_TOKEN"),
    os.path.join(os.path.expanduser("~"), ".hermes", "google_token.json"),
    os.path.join(os.path.expanduser("~"), ".config", "consultant", "google_token.json"),
    os.path.join(os.path.expanduser("~"), ".google_token.json"),
    "/home/hermes/.hermes/google_token.json",
]


def etat_jeton(chemin):
    """'ok', 'absent' ou 'interdit'.

    Un fichier situé dans le home d'un autre utilisateur est indétectable :
    sans droit de traversée sur le dossier parent, os.path.exists() répond
    False exactement comme s'il n'existait pas. On tente donc l'ouverture
    pour distinguer les deux cas — c'est la seule façon de le savoir.
    """
    try:
        with open(chemin, "rb"):
            return "ok"
    except IOError as e:
        if e.errno in (errno.EACCES, errno.EPERM):
            return "interdit"
        return "absent"
    except OSError:
        return "absent"


def trouver_jeton():
    for c in CANDIDATS_JETON:
        if c and etat_jeton(c) == "ok":
            return c
    return None


def expliquer_absence():
    """Affiche ce qui a été tenté et la marche à suivre, puis quitte."""
    interdits = []
    print(u"Jeton OAuth Google inutilisable. Emplacements essayés :")
    for c in CANDIDATS_JETON:
        if not c:
            continue
        etat = etat_jeton(c)
        if etat == "interdit":
            interdits.append(c)
            print(u"  - %s   -> existe, mais droits insuffisants" % c)
        else:
            print(u"  - %s   -> absent" % c)
    print(u"")
    if interdits:
        print(u"Le jeton appartient à un autre utilisateur. Copiez-le dans votre")
        print(u"compte, en le gardant lisible par vous seul :")
        print(u"")
        print(u"  mkdir -p ~/.config/consultant")
        print(u"  sudo cp %s ~/.config/consultant/google_token.json" % interdits[0])
        print(u"  sudo chown $(id -un):$(id -gn) ~/.config/consultant/google_token.json")
        print(u"  chmod 600 ~/.config/consultant/google_token.json")
        print(u"")
        print(u"Ce chemin fait partie de ceux testés : relancez ensuite sans rien préciser.")
    else:
        print(u"Localisez-le :")
        print(u"  sudo find /home -name 'google_token.json' 2>/dev/null")
        print(u"puis relancez en indiquant le chemin trouvé :")
        print(u"  GOOGLE_TOKEN=/chemin/vers/google_token.json python3 <script>")
    sys.exit(1)


def services(avec_sheets=True):
    """Retourne (drive, sheets) ; sheets vaut None si avec_sheets est faux."""
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
    except ImportError:
        sys.exit(u"""Dépendances Google absentes.

Sur Raspberry Pi OS récent, pip refuse d'installer dans le système
(PEP 668 / externally-managed-environment). Il faut un environnement virtuel :

  sudo apt install -y python3-venv
  python3 -m venv ~/.venvs/consultant
  ~/.venvs/consultant/bin/pip install -q google-api-python-client google-auth openpyxl
  ~/.venvs/consultant/bin/python ~/consultant/sheets/push_to_drive.py

Ou, en une seule commande depuis ~/consultant :  ./deploy-rpi.sh --drive
""")

    jeton = trouver_jeton()
    if not jeton:
        expliquer_absence()
    print(u"Jeton : %s" % jeton)
    tk = json.load(open(jeton))
    creds = Credentials(
        token=tk.get("token") or tk.get("access_token"),
        refresh_token=tk["refresh_token"],
        token_uri=tk["token_uri"],
        client_id=tk["client_id"],
        client_secret=tk["client_secret"],
        scopes=tk.get("scopes"),
    )
    drive = build("drive", "v3", credentials=creds)
    sheets = build("sheets", "v4", credentials=creds) if avec_sheets else None
    return drive, sheets


def dossier_cible(drive, nom):
    """Identifiant du dossier Drive `nom`, créé au besoin."""
    q = (u"name = '%s' and mimeType = 'application/vnd.google-apps.folder' "
         u"and trashed = false" % nom.replace("'", "\\'"))
    trouves = drive.files().list(q=q, spaces="drive", fields="files(id,name)",
                                 pageSize=10).execute().get("files", [])
    if trouves:
        print(u"Dossier existant : %s (%s)" % (nom, trouves[0]["id"]))
        return trouves[0]["id"]
    cree = drive.files().create(
        body={"name": nom, "mimeType": "application/vnd.google-apps.folder"},
        fields="id").execute()
    print(u"Dossier créé : %s (%s)" % (nom, cree["id"]))
    return cree["id"]
