#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
push_html_to_drive.py — Envoie l'étude HTML sur Google Drive, en un seul fichier.

Assemble index.html + assets/ en un document autonome (CSS et JavaScript
intégrés, aucune ressource externe), puis le dépose dans le dossier Drive
« #Consultant + MRR ». Relancer met à jour le fichier existant au lieu d'en
créer un second.

Le fichier est déposé tel quel, sans conversion en Google Doc : la conversion
détruirait les graphiques et les paramètres interactifs.

Usage :
  python3 sheets/push_html_to_drive.py
  python3 sheets/push_html_to_drive.py --local  # écrit seulement le fichier
"""

from __future__ import print_function

import io
import os
import re
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
sys.path.insert(0, ICI)

DOSSIER = os.environ.get("DRIVE_FOLDER", u"#Consultant + MRR")
TITRE = os.environ.get("HTML_TITLE", u"Consultant agent IA — étude.html")
SORTIE = os.path.join(ICI, "consultant-agent-ia-autonome.html")


def assembler():
    """Document HTML complet, CSS et JS intégrés, sans ressource externe."""
    chemin = os.path.join(RACINE, "index.html")
    if not os.path.exists(chemin):
        sys.exit(u"index.html introuvable dans %s" % RACINE)
    html = io.open(chemin, encoding="utf-8").read()

    css_path = os.path.join(RACINE, "assets", "style.css")
    css = io.open(css_path, encoding="utf-8").read()
    js = []
    for nom in ("model.js", "charts.js", "app.js"):
        js.append(io.open(os.path.join(RACINE, "assets", nom), encoding="utf-8").read())

    # On conserve le <head> d'origine — charset, viewport, description, favicon —
    # et on y remplace les liens externes par leur contenu.
    tete, reste = html.split("</head>", 1)
    tete = tete.replace('<link rel="stylesheet" href="assets/style.css">',
                        u"<style>\n%s\n</style>" % css)
    corps = re.sub(r'\s*<script src="assets/[^"]+"></script>', "", reste)
    corps = corps.replace("</body>", u"<script>\n%s\n</script>\n</body>" % u"\n".join(js))
    doc = tete + "</head>" + corps

    for attendu in ("<!DOCTYPE html>", '<meta charset="utf-8">', "name=\"viewport\"", "</html>"):
        if attendu not in doc:
            sys.exit(u"Assemblage incomplet : « %s » manquant." % attendu)
    if "assets/" in doc:
        sys.exit(u"Assemblage incomplet : il reste une référence à assets/.")

    io.open(SORTIE, "w", encoding="utf-8").write(doc)
    print(u"Document autonome : %s (%.0f Ko)" % (SORTIE, os.path.getsize(SORTIE) / 1024.0))
    return SORTIE


def envoyer(chemin):
    from googleapiclient.http import MediaFileUpload
    import google_auth

    drive, _ = google_auth.services(avec_sheets=False)
    folder_id = google_auth.dossier_cible(drive, DOSSIER)

    q = (u"name = '%s' and '%s' in parents and trashed = false"
         % (TITRE.replace("'", "\\'"), folder_id))
    trouves = drive.files().list(q=q, spaces="drive", fields="files(id,name)",
                                 pageSize=5).execute().get("files", [])

    media = MediaFileUpload(chemin, mimetype="text/html", resumable=False)
    if trouves:
        fid = trouves[0]["id"]
        drive.files().update(fileId=fid, media_body=media).execute()
        print(u"Fichier mis à jour : %s" % fid)
    else:
        cree = drive.files().create(
            body={"name": TITRE, "parents": [folder_id], "mimeType": "text/html"},
            media_body=media, fields="id").execute()
        fid = cree["id"]
        print(u"Fichier créé : %s" % fid)

    print(u"")
    print(u"OK %s" % TITRE)
    print(u"  dossier : %s" % DOSSIER)
    print(u"  URL     : https://drive.google.com/file/d/%s/view" % fid)
    print(u"")
    print(u"Drive ne rend pas les pages HTML : téléchargez le fichier et ouvrez-le")
    print(u"dans un navigateur, ou passez par l'aperçu si une extension le permet.")
    return fid


def main():
    chemin = assembler()
    if "--local" in sys.argv:
        print(u"Mode --local : fichier écrit, envoi Drive ignoré.")
        return 0
    envoyer(chemin)
    return 0


if __name__ == "__main__":
    sys.exit(main())
