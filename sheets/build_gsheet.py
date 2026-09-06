#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
build_gsheet.py — Génère le classeur « Consultant agent IA v2 ».

Le classeur est entièrement piloté par formules : la feuille « Paramètres » est
la seule source de vérité, toutes les autres feuilles la référencent. Modifier
une valeur dans Paramètres recalcule l'ensemble du classeur, exactement comme la
page HTML de l'étude.

Sortie : consultant-agent-ia-v2.xlsx (importable tel quel dans Google Sheets).
"""

import os
import sys

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.chart import LineChart, BarChart, PieChart, Reference
from openpyxl.formatting.rule import ColorScaleRule

# ---------------------------------------------------------------------------
# Charte graphique (reprise de la page HTML)
# ---------------------------------------------------------------------------
INK = "1D1D1F"
MUTED = "6E6E73"
BLUE = "0071E3"
TEAL = "00B8A9"
GREEN = "34C759"
ORANGE = "FF9F0A"
INDIGO = "5E5CE6"
PURPLE = "AF52DE"
RED = "FF3B30"
GREY = "8E8E93"
BG_HEAD = "F5F5F7"
BG_ALT = "FBFBFD"

F_TITRE = Font(name="Calibri", size=18, bold=True, color=INK)
F_SOUS = Font(name="Calibri", size=11, color=MUTED, italic=True)
F_H = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
F_SECTION = Font(name="Calibri", size=12, bold=True, color=BLUE)
F_LABEL = Font(name="Calibri", size=11, color=INK)
F_VAL = Font(name="Calibri", size=11, bold=True, color=INK)
F_NOTE = Font(name="Calibri", size=9, color=MUTED)

FILL_H = PatternFill("solid", fgColor=BLUE)
FILL_H2 = PatternFill("solid", fgColor="3D3D42")
FILL_PARAM = PatternFill("solid", fgColor="FFF8E7")
FILL_ALT = PatternFill("solid", fgColor=BG_ALT)
FILL_KPI = PatternFill("solid", fgColor="EEF6FF")
FILL_TOT = PatternFill("solid", fgColor=BG_HEAD)

THIN = Side(style="thin", color="D2D2D7")
BORD = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
BAS = Border(bottom=THIN)

FMT_EUR = u'#,##0 "€"'
FMT_EUR2 = u'#,##0.00 "€"'
FMT_NB1 = '#,##0.0'
FMT_NB2 = '#,##0.00'
FMT_NB0 = '#,##0'
FMT_PCT = '0.0 %'
FMT_PCT0 = '0 %'
FMT_H = u'#,##0.0 "h"'
FMT_H0 = u'#,##0 "h"'
FMT_J = u'#,##0.0 "j"'
FMT_MOIS = 'mm/yy'

P = "'Paramètres'"   # référence inter-feuille
H = "'Hypothèses'"
M = "'MRR mensuel'"

NB_MOIS = 37          # 01/2027 -> 01/2030 inclus
LIG_M0 = 4            # première ligne de données de la feuille MRR
LIG_M1 = LIG_M0 + NB_MOIS - 1


# ---------------------------------------------------------------------------
# Feuille 1 — Lisez-moi
# ---------------------------------------------------------------------------
def feuille_lisezmoi(wb):
    ws = wb.create_sheet("Lisez-moi")
    ws.sheet_view.showGridLines = False
    ws.column_dimensions['A'].width = 3
    ws.column_dimensions['B'].width = 104

    lignes = [
        ("titre", "Consultant agent IA — étude de rentabilité v2"),
        ("sous", "Déploiement d'agents IA + abonnement mensuel récurrent · projection 01/2027 -> 01/2030"),
        ("vide", ""),
        ("section", "Comment utiliser ce classeur"),
        ("txt", "1.  Ouvrez l'onglet « Paramètres ». C'est la seule feuille où vous saisissez des valeurs."),
        ("txt", "2.  Les cellules à fond crème de la colonne C sont modifiables. Tout le reste est calculé."),
        ("txt", "3.  Toutes les autres feuilles se recalculent automatiquement : hypothèses, MRR mensuel,"),
        ("txt", "     synthèse annuelle, jalons, sensibilité, scénarios et graphiques."),
        ("txt", "4.  Aucune valeur n'est figée en dur ailleurs que dans « Paramètres »."),
        ("vide", ""),
        ("section", "Le modèle en une phrase"),
        ("txt", "Un diagnostic gratuit chaque semaine, converti une fois sur deux en déploiement d'agent IA"),
        ("txt", "facturé 997 €, suivi d'un abonnement de 185 € par mois tant que l'agent reste en production."),
        ("txt", "Le diagnostic non converti est le coût du modèle : du temps, jamais d'argent."),
        ("vide", ""),
        ("section", "Organisation des onglets"),
        ("liste", "Paramètres — les 22 variables d'entrée, groupées par thème"),
        ("liste", "Résultats clés — le tableau de bord : indicateurs de synthèse et graphiques principaux"),
        ("liste", "Hypothèses — l'entonnoir commercial et la charge horaire dérivés des paramètres"),
        ("liste", "Temps & capacité — salariat, marge cognitive, charge réelle du business"),
        ("liste", "Unit economics — ce que vaut un client : €/h, LTV, rétention"),
        ("liste", "MRR mensuel — les 37 mois de projection, ligne à ligne, avec les graphiques associés"),
        ("liste", "Synthèse annuelle — les agrégats par exercice"),
        ("liste", "Jalons — la date de franchissement de chaque seuil"),
        ("liste", "Sensibilité — deux matrices : levier volume et levier prix"),
        ("liste", "Scénarios — cinq trajectoires, du pessimiste à l'agressif"),
        ("vide", ""),
        ("section", "Portée et limites"),
        ("txt", "Projection déterministe, pas une prévision. La fiscalité est approchée par un taux global"),
        ("txt", "unique (cotisations + impôt sur le revenu + frais d'API des agents). L'acquisition est"),
        ("txt", "supposée linéaire et constante. Aucun coût fixe d'infrastructure n'est isolé."),
        ("vide", ""),
        ("note", "Pour allonger l'horizon au-delà de 37 mois : recopier la dernière ligne de « MRR mensuel » vers le bas."),
        ("note", "Version HTML interactive de la même étude : index.html du dépôt « consultant »."),
    ]
    r = 2
    for typ, txt in lignes:
        c = ws.cell(row=r, column=2, value=txt)
        if typ == "titre":
            c.font = F_TITRE
            ws.row_dimensions[r].height = 26
        elif typ == "sous":
            c.font = F_SOUS
        elif typ == "section":
            c.font = F_SECTION
            ws.row_dimensions[r].height = 22
        elif typ == "liste":
            c.font = F_LABEL
            c.value = u"    •  " + txt
        elif typ == "note":
            c.font = F_NOTE
        else:
            c.font = F_LABEL
        c.alignment = Alignment(vertical="center")
        r += 1
    return ws


# ---------------------------------------------------------------------------
# Feuille 2 — Paramètres
# ---------------------------------------------------------------------------
GROUPES = [
    (u"Offre & tarification", [
        ("prix_abo", u"Prix abonnement mensuel (MRR par client)", 185, u"€/mois", FMT_EUR,
         u"Facturé chaque mois tant que l'agent est en production."),
        ("prix_depl", u"Prix de la prestation de déploiement", 997, u"€", FMT_EUR,
         u"Ticket d'entrée, facturé une seule fois après la semaine de test."),
        ("jours_depl", u"Jours de travail par déploiement", 2, u"j", FMT_NB2,
         u"Temps d'implémentation d'un agent (ex. OCR devis vers base de données)."),
    ]),
    (u"Acquisition commerciale", [
        ("diag_sem", u"Diagnostics gratuits par semaine", 1, u"/sem", FMT_NB2,
         u"Offre d'appel. Le volume de diagnostics pilote tout l'entonnoir."),
        ("h_diag", u"Durée d'un diagnostic", 1, u"h", FMT_NB2,
         u"Temps consommé par diagnostic, converti ou non."),
        ("conv", u"Taux de conversion diagnostic vers déploiement", 0.50, u"%", FMT_PCT0,
         u"Part des diagnostics qui débouchent sur un déploiement payé."),
        ("jours_mkt", u"Jours de marketing / prospection par semaine", 1, u"j/sem", FMT_NB2,
         u"Contenu, réseau, démarchage : le carburant des diagnostics."),
        ("retention", u"Taux de rétention annuel des abonnements", 0.85, u"%", FMT_PCT0,
         u"Part des clients encore abonnés 12 mois plus tard."),
    ]),
    (u"Temps & capacité", [
        ("jours_an", u"Jours travaillés par an (base 5 j/semaine)", 208, u"j/an", FMT_NB0,
         u"208 j = 41,6 semaines de 5 jours."),
        ("h_jour", u"Heures de travail par jour", 7, u"h/j", FMT_NB1,
         u"Base de conversion jours vers heures."),
        ("h_dispo_jour", u"Heures/jour disponibles pour l'agent IA", 3, u"h/j", FMT_NB2,
         u"Capacité réelle, hors salariat et vie personnelle."),
    ]),
    (u"Salariat Naval Group", [
        ("salaire", u"Salaire mensuel net d'impôt (après IR)", 3400, u"€/mois", FMT_EUR,
         u"Montant réellement disponible chaque mois, prélèvement à la source déjà déduit."),
        ("ng_jours_sem", u"Jours travaillés par semaine (temps partiel)", 4, u"j/sem", FMT_NB1,
         u"Contrat à temps partiel."),
        ("ng_h_presence", u"Heures de présence par jour", 8, u"h/j", FMT_NB1,
         u"Temps de présence contractuel."),
        ("ng_h_cerebral", u"Heures de travail cérébral réel par jour", 3, u"h/j", FMT_NB2,
         u"Production intellectuelle effective."),
        ("ng_semaines", u"Semaines travaillées par an", 44, u"sem/an", FMT_NB0,
         u"52 semaines moins congés et RTT."),
        ("ng_teletravail", u"Jours de télétravail par semaine", 1, u"j/sem", FMT_NB1,
         u"Déduits des jours de présence sur site."),
    ]),
    (u"Fiscalité & train de vie", [
        ("net_ir_cons", u"Part du CA consultant conservée (net IR)", 0.50, u"%", FMT_PCT0,
         u"Cotisations + impôt sur le revenu + frais d'API des agents IA."),
        ("depenses", u"Dépenses personnelles mensuelles", 1800, u"€/mois", FMT_EUR,
         u"Train de vie complet. Sert au calcul de l'épargne."),
    ]),
    (u"Horizon de projection", [
        ("annee0", u"Année du premier mois projeté", 2027, u"", FMT_NB0,
         u"Le tableau MRR démarre à ce mois et couvre 37 mois."),
        ("mois0", u"Mois du premier mois projeté (1 = janvier)", 1, u"", FMT_NB0,
         u"1 pour janvier. Le tableau va jusqu'à 01/2030 avec les valeurs par défaut."),
    ]),
]

REF = {}   # clé -> "'Paramètres'!$C$12"


def feuille_parametres(wb):
    ws = wb.create_sheet(u"Paramètres")
    ws.sheet_view.showGridLines = False
    for col, w in zip("ABCDEF", (2, 52, 15, 11, 13, 74)):
        ws.column_dimensions[col].width = w

    ws.cell(row=2, column=2, value=u"Paramètres du modèle").font = F_TITRE
    ws.cell(row=3, column=2,
            value=u"Seules les cellules à fond crème sont à modifier. Tout le classeur se recalcule.").font = F_SOUS

    r = 5
    for titre, params in GROUPES:
        ws.cell(row=r, column=2, value=titre).font = F_SECTION
        r += 1
        for col, lib in zip("BCDEF", (u"Paramètre", u"Valeur", u"Unité", u"Défaut", u"Rôle dans le modèle")):
            c = ws.cell(row=r, column=ws[col + "1"].column, value=lib)
            c.font = F_H
            c.fill = FILL_H
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.border = BORD
        ws.row_dimensions[r].height = 18
        r += 1
        for key, label, defaut, unite, fmt, aide in params:
            ws.cell(row=r, column=2, value=label).font = F_LABEL
            cv = ws.cell(row=r, column=3, value=defaut)
            cv.font = F_VAL
            cv.fill = FILL_PARAM
            cv.number_format = fmt
            cv.alignment = Alignment(horizontal="right")
            cv.border = BORD
            ws.cell(row=r, column=4, value=unite).font = F_NOTE
            cd = ws.cell(row=r, column=5, value=defaut)
            cd.font = F_NOTE
            cd.number_format = fmt
            cd.alignment = Alignment(horizontal="right")
            ws.cell(row=r, column=6, value=aide).font = F_NOTE
            for col in range(2, 7):
                ws.cell(row=r, column=col).border = BAS
            REF[key] = u"%s!$C$%d" % (P, r)
            r += 1
        r += 1

    ws.cell(row=r, column=2,
            value=u"Colonne « Défaut » : valeur d'origine de l'étude, conservée pour référence.").font = F_NOTE
    return ws


# ---------------------------------------------------------------------------
# Feuille 3 — Hypothèses (entonnoir + charge horaire)
# ---------------------------------------------------------------------------
HYP = {}


def _bloc(ws, r, titre):
    ws.cell(row=r, column=2, value=titre).font = F_SECTION
    r += 1
    for col, lib in ((2, u"Indicateur"), (3, u"Valeur"), (4, u"Unité"), (5, u"Formule")):
        c = ws.cell(row=r, column=col, value=lib)
        c.font = F_H
        c.fill = FILL_H
        c.alignment = Alignment(horizontal="center")
        c.border = BORD
    return r + 1


def _ligne(ws, r, key, label, formule, unite, fmt, explication, store):
    ws.cell(row=r, column=2, value=label).font = F_LABEL
    c = ws.cell(row=r, column=3, value=formule)
    c.font = F_VAL
    c.number_format = fmt
    c.alignment = Alignment(horizontal="right")
    c.border = BORD
    ws.cell(row=r, column=4, value=unite).font = F_NOTE
    ws.cell(row=r, column=5, value=explication).font = F_NOTE
    for col in range(2, 6):
        ws.cell(row=r, column=col).border = BAS
    if key:
        store[key] = u"'%s'!$C$%d" % (ws.title, r)
    return r + 1


def feuille_hypotheses(wb):
    ws = wb.create_sheet(u"Hypothèses")
    ws.sheet_view.showGridLines = False
    for col, w in zip("ABCDE", (2, 50, 15, 11, 62)):
        ws.column_dimensions[col].width = w

    ws.cell(row=2, column=2, value=u"Hypothèses dérivées").font = F_TITRE
    ws.cell(row=3, column=2,
            value=u"Tout est calculé à partir de la feuille Paramètres. Aucune saisie ici.").font = F_SOUS

    R = REF
    r = _bloc(ws, 5, u"Entonnoir commercial")
    r = _ligne(ws, r, "semaines", u"Semaines travaillées par an", u"=%s/5" % R["jours_an"],
               u"sem", FMT_NB1, u"jours_travaillés / 5", HYP)
    r = _ligne(ws, r, "diag_an", u"Diagnostics gratuits par an", u"=%s*%s" % (R["diag_sem"], HYP["semaines"]),
               u"/an", FMT_NB1, u"diagnostics_semaine × semaines", HYP)
    r = _ligne(ws, r, "clients_an", u"Automatisations vendues par an", u"=%s*%s" % (HYP["diag_an"], R["conv"]),
               u"/an", FMT_NB1, u"diagnostics_an × taux_conversion", HYP)
    r = _ligne(ws, r, "auto_sem", u"Automatisations vendues par semaine", u"=%s*%s" % (R["diag_sem"], R["conv"]),
               u"/sem", FMT_NB2, u"diagnostics_semaine × taux_conversion", HYP)
    r = _ligne(ws, r, "nouveaux_mois", u"Nouveaux clients par mois", u"=%s/12" % HYP["clients_an"],
               u"/mois", FMT_NB2, u"clients_an / 12", HYP)
    r = _ligne(ws, r, "ca_depl_an", u"CA de déploiement annuel", u"=%s*%s" % (HYP["clients_an"], R["prix_depl"]),
               u"€/an", FMT_EUR, u"clients_an × prix_déploiement", HYP)
    r += 1

    r = _bloc(ws, r, u"Charge horaire de l'activité")
    r = _ligne(ws, r, "h_par_auto", u"Heures par automatisation", u"=%s*%s" % (R["jours_depl"], R["h_jour"]),
               u"h", FMT_H, u"jours_déploiement × heures_par_jour", HYP)
    r = _ligne(ws, r, "h_diag_an", u"Heures de diagnostic par an", u"=%s*%s" % (HYP["diag_an"], R["h_diag"]),
               u"h/an", FMT_H0, u"diagnostics_an × durée_diagnostic", HYP)
    r = _ligne(ws, r, "h_depl_an", u"Heures de déploiement par an", u"=%s*%s" % (HYP["clients_an"], HYP["h_par_auto"]),
               u"h/an", FMT_H0, u"clients_an × heures_par_automatisation", HYP)
    r = _ligne(ws, r, "h_mkt_an", u"Heures de marketing par an",
               u"=%s*%s*%s" % (R["jours_mkt"], HYP["semaines"], R["h_jour"]),
               u"h/an", FMT_H0, u"jours_marketing × semaines × heures_par_jour", HYP)
    r = _ligne(ws, r, "h_total_an", u"Heures totales par an",
               u"=%s+%s+%s" % (HYP["h_diag_an"], HYP["h_depl_an"], HYP["h_mkt_an"]),
               u"h/an", FMT_H0, u"diagnostic + déploiement + marketing", HYP)
    r = _ligne(ws, r, "h_hors_mkt", u"Heures hors marketing par an",
               u"=%s+%s" % (HYP["h_diag_an"], HYP["h_depl_an"]),
               u"h/an", FMT_H0, u"diagnostic + déploiement", HYP)
    r = _ligne(ws, r, "h_hebdo", u"Heures hebdomadaires sur le business",
               u"=%s/%s" % (HYP["h_total_an"], HYP["semaines"]), u"h/sem", FMT_H, u"heures_total / semaines", HYP)
    r = _ligne(ws, r, "j_eq_hebdo", u"Jours équivalents travaillés par semaine",
               u"=%s/%s" % (HYP["h_hebdo"], R["h_jour"]), u"j/sem", FMT_NB2,
               u"heures_hebdo / heures_par_jour", HYP)
    r = _ligne(ws, r, "j_eq_an", u"Jours équivalents travaillés par an",
               u"=%s/%s" % (HYP["h_total_an"], R["h_jour"]), u"j/an", FMT_NB1,
               u"heures_total_an / heures_par_jour", HYP)
    r = _ligne(ws, r, "h_capacite", u"Capacité annuelle déclarée",
               u"=%s*%s" % (R["jours_an"], R["h_dispo_jour"]), u"h/an", FMT_H0,
               u"jours_travaillés × heures_dispo_par_jour", HYP)
    r = _ligne(ws, r, "h_dispo_an", u"Heures disponibles théoriques (plein temps)",
               u"=%s*%s" % (R["jours_an"], R["h_jour"]), u"h/an", FMT_H0,
               u"jours_travaillés × heures_par_jour", HYP)
    r = _ligne(ws, r, "taux_charge", u"Taux de charge (charge / capacité)",
               u"=%s/%s" % (HYP["h_total_an"], HYP["h_capacite"]), u"%", FMT_PCT,
               u"100 % = capacité exactement saturée", HYP)
    r = _ligne(ws, r, "charge_h_jour", u"Heures réellement nécessaires par jour",
               u"=%s/%s" % (HYP["h_total_an"], R["jours_an"]), u"h/j", FMT_NB2,
               u"heures_total_an / jours_travaillés", HYP)
    r = _ligne(ws, r, "pct_prospect", u"Part du temps à prospecter, pas à implémenter",
               u"=(%s+%s)/%s" % (HYP["h_diag_an"], HYP["h_mkt_an"], HYP["h_total_an"]), u"%", FMT_PCT,
               u"(diagnostic + marketing) / total", HYP)
    r += 1

    r = _bloc(ws, r, u"Rétention et récurrence")
    r = _ligne(ws, r, "churn", u"Churn mensuel équivalent", u"=1-%s^(1/12)" % R["retention"],
               u"%/mois", '0.00 %', u"1 − rétention_annuelle^(1/12)", HYP)
    r = _ligne(ws, r, "survie", u"Survie mensuelle", u"=1-%s" % HYP["churn"], u"%", '0.00 %',
               u"1 − churn_mensuel", HYP)
    r = _ligne(ws, r, "duree_vie", u"Durée de vie moyenne d'un abonnement", u"=1/%s" % HYP["churn"],
               u"mois", FMT_NB1, u"1 / churn_mensuel", HYP)
    r = _ligne(ws, r, "plateau_clients", u"Clients au plateau (entrées = churn)",
               u"=%s/%s" % (HYP["nouveaux_mois"], HYP["churn"]), u"clients", FMT_NB1,
               u"nouveaux_mois / churn_mensuel", HYP)
    r = _ligne(ws, r, "plateau_mrr", u"MRR au plateau",
               u"=%s*%s" % (HYP["plateau_clients"], R["prix_abo"]), u"€/mois", FMT_EUR,
               u"clients_plateau × prix_abonnement", HYP)
    r = _ligne(ws, r, "plateau_ca", u"CA annuel au plateau",
               u"=%s*12+%s" % (HYP["plateau_mrr"], HYP["ca_depl_an"]), u"€/an", FMT_EUR,
               u"MRR_plateau × 12 + CA_déploiement_an", HYP)
    r = _ligne(ws, r, "plateau_net", u"Net IR annuel au plateau",
               u"=%s*%s" % (HYP["plateau_ca"], R["net_ir_cons"]), u"€/an", FMT_EUR,
               u"CA_plateau × taux_net_IR", HYP)
    r += 1

    r = _bloc(ws, r, u"Salariat")
    r = _ligne(ws, r, "sal_net_mois", u"Salaire mensuel net d'IR",
               u"=%s" % R["salaire"], u"€/mois", FMT_EUR,
               u"paramètre : déjà net d'impôt", HYP)
    r = _ligne(ws, r, "sal_net_an", u"Salaire annuel net d'IR", u"=%s*12" % HYP["sal_net_mois"],
               u"€/an", FMT_EUR, u"salaire_net_mensuel × 12", HYP)
    return ws


# ---------------------------------------------------------------------------
# Feuille 4 — MRR mensuel
# ---------------------------------------------------------------------------
COLS_MRR = [
    ("A", u"Mois", 11, FMT_MOIS),
    ("B", u"Nouveaux clients", 15, FMT_NB2),
    ("C", u"Clients perdus", 14, FMT_NB2),
    ("D", u"Clients actifs", 13, FMT_NB1),
    ("E", u"CA déploiement", 15, FMT_EUR),
    ("F", u"MRR", 12, FMT_EUR),
    ("G", u"CA total", 13, FMT_EUR),
    ("H", u"Net MRR", 12, FMT_EUR),
    ("I", u"Net déploiement", 15, FMT_EUR),
    ("J", u"Net consultant", 15, FMT_EUR),
    ("K", u"Salaire net IR", 14, FMT_EUR),
    ("L", u"Revenu total net", 16, FMT_EUR),
    ("M", u"Épargne", 12, FMT_EUR),
    ("N", u"CA cumulé", 14, FMT_EUR),
    ("O", u"Épargne cumulée", 16, FMT_EUR),
    ("P", u"Part MRR / CA", 13, FMT_PCT0),
    ("Q", u"h / semaine", 12, FMT_NB1),
    ("R", u"j éq. / semaine", 14, FMT_NB2),
]


def feuille_mrr(wb):
    ws = wb.create_sheet(u"MRR mensuel")
    ws.sheet_view.showGridLines = False
    ws.cell(row=1, column=1, value=u"Projection mensuelle du MRR").font = F_TITRE
    ws.cell(row=2, column=1,
            value=u"37 mois. Toutes les cellules sont des formules : modifiez la feuille Paramètres.").font = F_SOUS

    hr = LIG_M0 - 1
    for col, lib, w, fmt in COLS_MRR:
        ws.column_dimensions[col].width = w
        c = ws[col + str(hr)]
        c.value = lib
        c.font = F_H
        c.fill = FILL_H
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BORD
    ws.row_dimensions[hr].height = 30
    ws.freeze_panes = "B" + str(LIG_M0)

    R, Y = REF, HYP
    for i in range(NB_MOIS):
        r = LIG_M0 + i
        prev = r - 1
        if i == 0:
            ws["A%d" % r] = u"=DATE(%s,%s,1)" % (R["annee0"], R["mois0"])
            ws["C%d" % r] = 0
            ws["D%d" % r] = u"=B%d" % r
            ws["N%d" % r] = u"=G%d" % r
            ws["O%d" % r] = u"=M%d" % r
        else:
            ws["A%d" % r] = u"=EDATE(A%d,1)" % prev
            ws["C%d" % r] = u"=D%d*%s" % (prev, Y["churn"])
            ws["D%d" % r] = u"=D%d-C%d+B%d" % (prev, r, r)
            ws["N%d" % r] = u"=N%d+G%d" % (prev, r)
            ws["O%d" % r] = u"=O%d+M%d" % (prev, r)
        ws["B%d" % r] = u"=%s" % Y["nouveaux_mois"]
        ws["E%d" % r] = u"=B%d*%s" % (r, R["prix_depl"])
        ws["F%d" % r] = u"=D%d*%s" % (r, R["prix_abo"])
        ws["G%d" % r] = u"=E%d+F%d" % (r, r)
        ws["H%d" % r] = u"=F%d*%s" % (r, R["net_ir_cons"])
        ws["I%d" % r] = u"=E%d*%s" % (r, R["net_ir_cons"])
        ws["J%d" % r] = u"=G%d*%s" % (r, R["net_ir_cons"])
        ws["K%d" % r] = u"=%s" % Y["sal_net_mois"]
        ws["L%d" % r] = u"=J%d+K%d" % (r, r)
        ws["M%d" % r] = u"=L%d-%s" % (r, R["depenses"])
        ws["P%d" % r] = u"=IF(G%d=0,0,F%d/G%d)" % (r, r, r)
        ws["Q%d" % r] = u"=%s" % Y["h_hebdo"]
        ws["R%d" % r] = u"=%s" % Y["j_eq_hebdo"]

        for col, lib, w, fmt in COLS_MRR:
            c = ws[col + str(r)]
            c.number_format = fmt
            c.border = BAS
            c.alignment = Alignment(horizontal="right")
            if i % 2 == 1:
                c.fill = FILL_ALT
        ws["A%d" % r].font = Font(name="Calibri", size=10, bold=True, color=INK)
        ws["F%d" % r].font = Font(name="Calibri", size=10, bold=True, color=TEAL)
        ws["L%d" % r].font = Font(name="Calibri", size=10, bold=True, color=BLUE)

    # ligne de total
    rt = LIG_M1 + 1
    ws["A%d" % rt] = u"Total 37 mois"
    ws["A%d" % rt].font = Font(name="Calibri", size=10, bold=True, color=INK)
    for col in "BCEFGHIJKLM":
        ws["%s%d" % (col, rt)] = u"=SUM(%s%d:%s%d)" % (col, LIG_M0, col, LIG_M1)
    ws["D%d" % rt] = u"=D%d" % LIG_M1
    for col, lib, w, fmt in COLS_MRR:
        c = ws[col + str(rt)]
        c.number_format = fmt
        c.fill = FILL_TOT
        c.font = Font(name="Calibri", size=10, bold=True, color=INK)
        c.border = Border(top=Side(style="medium", color="B0B0B8"), bottom=THIN)
        c.alignment = Alignment(horizontal="right")

    _graphiques_mrr(ws)
    return ws


def _graphiques_mrr(ws):
    dates = Reference(ws, min_col=1, min_row=LIG_M0, max_row=LIG_M1)

    ch = LineChart()
    ch.title = u"MRR et CA total mensuels"
    ch.style = 2
    ch.height, ch.width = 9, 22
    ch.y_axis.numFmt = u'#,##0 "€"'
    ch.y_axis.title = u"€ par mois"
    for col in (6, 7):     # F = MRR, G = CA total
        ch.add_data(Reference(ws, min_col=col, min_row=LIG_M0 - 1, max_row=LIG_M1), titles_from_data=True)
    ch.set_categories(dates)
    ch.series[0].graphicalProperties.line.width = 28000
    ch.series[0].graphicalProperties.line.solidFill = TEAL
    ch.series[1].graphicalProperties.line.solidFill = BLUE
    for s in ch.series:
        s.smooth = False
    ws.add_chart(ch, "T3")

    ch2 = LineChart()
    ch2.title = u"Clients actifs"
    ch2.style = 2
    ch2.height, ch2.width = 8, 22
    ch2.y_axis.title = u"clients"
    ch2.add_data(Reference(ws, min_col=4, min_row=LIG_M0 - 1, max_row=LIG_M1), titles_from_data=True)
    ch2.set_categories(dates)
    ch2.series[0].graphicalProperties.line.solidFill = INDIGO
    ch2.series[0].graphicalProperties.line.width = 28000
    ws.add_chart(ch2, "T22")

    ch3 = BarChart()
    ch3.type = "col"
    ch3.grouping = "stacked"
    ch3.overlap = 100
    ch3.title = u"Composition du chiffre d'affaires"
    ch3.height, ch3.width = 8, 22
    ch3.y_axis.numFmt = u'#,##0 "€"'
    for col in (5, 6):     # E déploiement, F MRR
        ch3.add_data(Reference(ws, min_col=col, min_row=LIG_M0 - 1, max_row=LIG_M1), titles_from_data=True)
    ch3.set_categories(dates)
    ch3.series[0].graphicalProperties.solidFill = BLUE
    ch3.series[1].graphicalProperties.solidFill = TEAL
    ws.add_chart(ch3, "T39")

    ch4 = LineChart()
    ch4.title = u"Revenu total net et épargne cumulée"
    ch4.height, ch4.width = 8, 22
    ch4.y_axis.numFmt = u'#,##0 "€"'
    for col in (12, 15):   # L revenu total, O épargne cumulée
        ch4.add_data(Reference(ws, min_col=col, min_row=LIG_M0 - 1, max_row=LIG_M1), titles_from_data=True)
    ch4.set_categories(dates)
    ch4.series[0].graphicalProperties.line.solidFill = BLUE
    ch4.series[1].graphicalProperties.line.solidFill = GREEN
    ws.add_chart(ch4, "T56")


# ---------------------------------------------------------------------------
# Feuille 5 — Synthèse annuelle
# ---------------------------------------------------------------------------
ANN_R0 = 5


def feuille_annuelle(wb):
    ws = wb.create_sheet(u"Synthèse annuelle")
    ws.sheet_view.showGridLines = False
    ws.cell(row=1, column=1, value=u"Synthèse par exercice").font = F_TITRE
    ws.cell(row=2, column=1,
            value=u"Agrégats calculés par année civile sur la feuille MRR mensuel.").font = F_SOUS

    entetes = [
        (u"Exercice", 11, FMT_NB0), (u"Mois", 8, FMT_NB0), (u"CA déploiement", 15, FMT_EUR),
        (u"CA abonnements", 15, FMT_EUR), (u"CA total", 14, FMT_EUR), (u"Part MRR", 11, FMT_PCT0),
        (u"Net consultant", 15, FMT_EUR), (u"Salaire net IR", 14, FMT_EUR),
        (u"Revenu total net", 16, FMT_EUR), (u"Dépenses", 13, FMT_EUR), (u"Épargne", 13, FMT_EUR),
        (u"Clients fin", 12, FMT_NB1), (u"MRR fin", 13, FMT_EUR), (u"Heures", 11, FMT_H0),
        (u"€/h net", 11, FMT_EUR2), (u"€/jour", 12, FMT_EUR2),
    ]
    hr = ANN_R0 - 1
    for i, (lib, w, fmt) in enumerate(entetes):
        col = get_column_letter(i + 1)
        ws.column_dimensions[col].width = w
        c = ws[col + str(hr)]
        c.value = lib
        c.font = F_H
        c.fill = FILL_H
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BORD
    ws.row_dimensions[hr].height = 30

    dat = u"%s!$A$%d:$A$%d" % (M, LIG_M0, LIG_M1)
    def rng(col):
        return u"%s!$%s$%d:$%s$%d" % (M, col, LIG_M0, col, LIG_M1)

    R, Y = REF, HYP
    for i in range(4):
        r = ANN_R0 + i
        ws["A%d" % r] = u"=%s+%d" % (R["annee0"], i) if i else u"=%s" % R["annee0"]
        cond = u"(YEAR(%s)=$A%d)" % (dat, r)
        ws["B%d" % r] = u"=SUMPRODUCT(--%s)" % cond
        ws["C%d" % r] = u"=SUMPRODUCT(%s*%s)" % (cond, rng("E"))
        ws["D%d" % r] = u"=SUMPRODUCT(%s*%s)" % (cond, rng("F"))
        ws["E%d" % r] = u"=C%d+D%d" % (r, r)
        ws["F%d" % r] = u"=IF(E%d=0,0,D%d/E%d)" % (r, r, r)
        ws["G%d" % r] = u"=SUMPRODUCT(%s*%s)" % (cond, rng("J"))
        ws["H%d" % r] = u"=SUMPRODUCT(%s*%s)" % (cond, rng("K"))
        ws["I%d" % r] = u"=G%d+H%d" % (r, r)
        ws["J%d" % r] = u"=B%d*%s" % (r, R["depenses"])
        ws["K%d" % r] = u"=I%d-J%d" % (r, r)
        ws["L%d" % r] = u"=IFERROR(LOOKUP(2,1/(YEAR(%s)=$A%d),%s),0)" % (dat, r, rng("D"))
        ws["M%d" % r] = u"=IFERROR(LOOKUP(2,1/(YEAR(%s)=$A%d),%s),0)" % (dat, r, rng("F"))
        ws["N%d" % r] = u"=%s*B%d/12" % (Y["h_total_an"], r)
        ws["O%d" % r] = u"=IF(N%d=0,0,G%d/N%d)" % (r, r, r)
        ws["P%d" % r] = u"=IF(B%d=0,0,I%d/(%s*B%d/12))" % (r, r, R["jours_an"], r)
        for j, (lib, w, fmt) in enumerate(entetes):
            c = ws[get_column_letter(j + 1) + str(r)]
            c.number_format = fmt
            c.border = BAS
            c.alignment = Alignment(horizontal="right")
            if i % 2 == 1:
                c.fill = FILL_ALT
        ws["A%d" % r].font = Font(name="Calibri", size=11, bold=True, color=INK)
        ws["E%d" % r].font = Font(name="Calibri", size=11, bold=True, color=BLUE)
        ws["I%d" % r].font = Font(name="Calibri", size=11, bold=True, color=GREEN)

    rt = ANN_R0 + 4
    ws["A%d" % rt] = u"Total"
    for col in "BCDEGHIJK":
        ws["%s%d" % (col, rt)] = u"=SUM(%s%d:%s%d)" % (col, ANN_R0, col, ANN_R0 + 3)
    ws["F%d" % rt] = u"=IF(E%d=0,0,D%d/E%d)" % (rt, rt, rt)
    ws["N%d" % rt] = u"=SUM(N%d:N%d)" % (ANN_R0, ANN_R0 + 3)
    for j, (lib, w, fmt) in enumerate(entetes):
        c = ws[get_column_letter(j + 1) + str(rt)]
        c.number_format = fmt
        c.fill = FILL_TOT
        c.font = Font(name="Calibri", size=11, bold=True, color=INK)
        c.border = Border(top=Side(style="medium", color="B0B0B8"))
        c.alignment = Alignment(horizontal="right")

    cats = Reference(ws, min_col=1, min_row=ANN_R0, max_row=ANN_R0 + 3)
    ch = BarChart()
    ch.type = "col"
    ch.grouping = "stacked"
    ch.overlap = 100
    ch.title = u"CA annuel : déploiement contre abonnements"
    ch.height, ch.width = 9, 20
    ch.y_axis.numFmt = u'#,##0 "€"'
    for col in (3, 4):
        ch.add_data(Reference(ws, min_col=col, min_row=hr, max_row=ANN_R0 + 3), titles_from_data=True)
    ch.set_categories(cats)
    ch.series[0].graphicalProperties.solidFill = BLUE
    ch.series[1].graphicalProperties.solidFill = TEAL
    ws.add_chart(ch, "A12")

    ch2 = BarChart()
    ch2.type = "col"
    ch2.grouping = "stacked"
    ch2.overlap = 100
    ch2.title = u"Revenu total net par exercice"
    ch2.height, ch2.width = 9, 20
    ch2.y_axis.numFmt = u'#,##0 "€"'
    for col in (8, 7):
        ch2.add_data(Reference(ws, min_col=col, min_row=hr, max_row=ANN_R0 + 3), titles_from_data=True)
    ch2.set_categories(cats)
    ch2.series[0].graphicalProperties.solidFill = GREY
    ch2.series[1].graphicalProperties.solidFill = TEAL
    ws.add_chart(ch2, "L12")

    ch3 = BarChart()
    ch3.type = "col"
    ch3.title = u"Épargne dégagée par exercice"
    ch3.height, ch3.width = 8, 20
    ch3.y_axis.numFmt = u'#,##0 "€"'
    ch3.add_data(Reference(ws, min_col=11, min_row=hr, max_row=ANN_R0 + 3), titles_from_data=True)
    ch3.set_categories(cats)
    ch3.series[0].graphicalProperties.solidFill = GREEN
    ws.add_chart(ch3, "A31")

    ch4 = BarChart()
    ch4.type = "col"
    ch4.title = u"Rendement net par heure travaillée"
    ch4.height, ch4.width = 8, 20
    ch4.y_axis.numFmt = u'#,##0.00 "€"'
    ch4.add_data(Reference(ws, min_col=15, min_row=hr, max_row=ANN_R0 + 3), titles_from_data=True)
    ch4.set_categories(cats)
    ch4.series[0].graphicalProperties.solidFill = ORANGE
    ws.add_chart(ch4, "L31")
    return ws


# ---------------------------------------------------------------------------
# Feuille 6 — Temps & capacité
# ---------------------------------------------------------------------------
def feuille_temps(wb):
    ws = wb.create_sheet(u"Temps & capacité")
    ws.sheet_view.showGridLines = False
    for col, w in zip("ABCDE", (2, 52, 15, 11, 58)):
        ws.column_dimensions[col].width = w
    ws.cell(row=2, column=2, value=u"Temps & capacité").font = F_TITRE
    ws.cell(row=3, column=2,
            value=u"Le modèle tient-il physiquement, à côté du salariat ?").font = F_SOUS

    R, Y, S = REF, HYP, {}
    r = _bloc(ws, 5, u"Socle salarié")
    r = _ligne(ws, r, "ng_pres_hebdo", u"Heures hebdomadaires de temps de présence",
               u"=%s*%s" % (R["ng_jours_sem"], R["ng_h_presence"]), u"h/sem", FMT_H,
               u"jours_semaine × heures_présence_jour", S)
    r = _ligne(ws, r, "ng_cer_hebdo", u"Heures hebdomadaires de travail cérébral",
               u"=%s*%s" % (R["ng_jours_sem"], R["ng_h_cerebral"]), u"h/sem", FMT_H,
               u"jours_semaine × heures_cérébral_jour", S)
    r = _ligne(ws, r, "ng_pres_an", u"Heures annuelles de présence",
               u"=%s*%s" % (S["ng_pres_hebdo"], R["ng_semaines"]), u"h/an", FMT_H0,
               u"heures_présence_hebdo × semaines", S)
    r = _ligne(ws, r, "ng_cer_an", u"Heures annuelles de travail cérébral",
               u"=%s*%s" % (S["ng_cer_hebdo"], R["ng_semaines"]), u"h/an", FMT_H0,
               u"heures_cérébral_hebdo × semaines", S)
    r = _ligne(ws, r, "ng_jours_an", u"Jours annuels travaillés à temps partiel",
               u"=%s*%s" % (R["ng_jours_sem"], R["ng_semaines"]), u"j/an", FMT_NB0,
               u"jours_semaine × semaines", S)
    r = _ligne(ws, r, "ng_site", u"Jours sur site par an (hors télétravail)",
               u"=(%s-%s)*%s" % (R["ng_jours_sem"], R["ng_teletravail"], R["ng_semaines"]), u"j/an", FMT_NB0,
               u"(jours_semaine − télétravail) × semaines", S)
    r = _ligne(ws, r, "ng_h_reel_jour", u"Heures de travail réel par jour de présence",
               u"=%s" % R["ng_h_cerebral"], u"h/j", FMT_NB2, u"paramètre direct", S)
    r = _ligne(ws, r, "ng_intensite", u"Intensité : travail réel / présence",
               u"=%s/%s" % (S["ng_cer_an"], S["ng_pres_an"]), u"%", FMT_PCT,
               u"heures_cérébral / heures_présence", S)
    r = _ligne(ws, r, "ng_marge", u"Marge cognitive annuelle disponible",
               u"=%s-%s" % (S["ng_pres_an"], S["ng_cer_an"]), u"h/an", FMT_H0,
               u"présence − travail cérébral", S)
    r = _ligne(ws, r, "ng_eur_h", u"Net IR par heure de présence",
               u"=%s/%s" % (Y["sal_net_an"], S["ng_pres_an"]), u"€/h", FMT_EUR2,
               u"salaire_net_annuel / heures_présence", S)
    r = _ligne(ws, r, "ng_eur_h_cer", u"Net IR par heure de travail réel",
               u"=%s/%s" % (Y["sal_net_an"], S["ng_cer_an"]), u"€/h", FMT_EUR2,
               u"salaire_net_annuel / heures_cérébral", S)
    r += 1

    r0_cap = r
    r = _bloc(ws, r, u"Capacité consultant")
    r = _ligne(ws, r, None, u"Jours travaillés par an", u"=%s" % R["jours_an"], u"j/an", FMT_NB0,
               u"paramètre", S)
    r = _ligne(ws, r, None, u"Semaines travaillées par an", u"=%s" % Y["semaines"], u"sem", FMT_NB1,
               u"jours_travaillés / 5", S)
    r = _ligne(ws, r, None, u"Heures disponibles de travail sur l'année", u"=%s" % Y["h_dispo_an"],
               u"h/an", FMT_H0, u"jours × heures_par_jour", S)
    r = _ligne(ws, r, None, u"Heures réellement nécessaires par jour", u"=%s" % Y["charge_h_jour"],
               u"h/j", FMT_NB2, u"charge / jours_travaillés", S)
    r = _ligne(ws, r, None, u"Heures annuelles consacrées à l'agent IA", u"=%s" % Y["h_total_an"],
               u"h/an", FMT_H0, u"diagnostic + déploiement + marketing", S)
    r = _ligne(ws, r, None, u"Heures hebdomadaires sur le business", u"=%s" % Y["h_hebdo"],
               u"h/sem", FMT_H, u"charge annuelle / semaines", S)
    r = _ligne(ws, r, None, u"Jours équivalents travaillés par semaine", u"=%s" % Y["j_eq_hebdo"],
               u"j/sem", FMT_NB2, u"heures_hebdo / heures_par_jour", S)
    r = _ligne(ws, r, None, u"Heures réellement travaillées hors marketing", u"=%s" % Y["h_hors_mkt"],
               u"h/an", FMT_H0, u"diagnostic + déploiement", S)
    r = _ligne(ws, r, None, u"Part du temps à prospecter, pas à implémenter", u"=%s" % Y["pct_prospect"],
               u"%", FMT_PCT, u"(diagnostic + marketing) / total", S)
    r = _ligne(ws, r, None, u"Taux de charge (charge / capacité déclarée)", u"=%s" % Y["taux_charge"],
               u"%", FMT_PCT, u"100 % = capacité saturée", S)
    r = _ligne(ws, r, "eng_hebdo", u"Charge combinée salariat + business, par semaine",
               u"=%s+%s" % (S["ng_pres_hebdo"], Y["h_hebdo"]), u"h/sem", FMT_H,
               u"présence salariée + business", S)
    r = _ligne(ws, r, "eng_an", u"Charge combinée annuelle",
               u"=%s+%s" % (S["ng_pres_an"], Y["h_total_an"]), u"h/an", FMT_H0,
               u"présence annuelle + charge annuelle", S)
    r += 1

    # Bloc pour le camembert de répartition du temps
    rr = r
    ws.cell(row=rr, column=2, value=u"Répartition annuelle des heures").font = F_SECTION
    rr += 1
    for lbl, ref, coul in ((u"Déploiements", Y["h_depl_an"], BLUE),
                           (u"Marketing / prospection", Y["h_mkt_an"], PURPLE),
                           (u"Diagnostics gratuits", Y["h_diag_an"], RED)):
        ws.cell(row=rr, column=2, value=lbl).font = F_LABEL
        c = ws.cell(row=rr, column=3, value=u"=%s" % ref)
        c.number_format = FMT_H0
        c.font = F_VAL
        c.alignment = Alignment(horizontal="right")
        rr += 1

    pie = PieChart()
    pie.title = u"Où passent les heures de l'année"
    pie.height, pie.width = 9, 13
    pie.add_data(Reference(ws, min_col=3, min_row=r + 1, max_row=r + 3), titles_from_data=False)
    pie.set_categories(Reference(ws, min_col=2, min_row=r + 1, max_row=r + 3))
    ws.add_chart(pie, "G%d" % r0_cap)

    bar = BarChart()
    bar.type = "bar"
    bar.title = u"Présence salariée contre production réelle (annuel)"
    bar.height, bar.width = 8, 13
    bar.y_axis.numFmt = u'#,##0 "h"'
    ws.cell(row=rr + 1, column=2, value=u"Présence annuelle").font = F_LABEL
    ws.cell(row=rr + 1, column=3, value=u"=%s" % S["ng_pres_an"]).number_format = FMT_H0
    ws.cell(row=rr + 2, column=2, value=u"Travail cérébral").font = F_LABEL
    ws.cell(row=rr + 2, column=3, value=u"=%s" % S["ng_cer_an"]).number_format = FMT_H0
    ws.cell(row=rr + 3, column=2, value=u"Business consultant").font = F_LABEL
    ws.cell(row=rr + 3, column=3, value=u"=%s" % Y["h_total_an"]).number_format = FMT_H0
    bar.add_data(Reference(ws, min_col=3, min_row=rr + 1, max_row=rr + 3), titles_from_data=False)
    bar.set_categories(Reference(ws, min_col=2, min_row=rr + 1, max_row=rr + 3))
    bar.series[0].graphicalProperties.solidFill = BLUE
    ws.add_chart(bar, "G%d" % (r0_cap + 18))
    return ws, S


# ---------------------------------------------------------------------------
# Feuille 7 — Unit economics
# ---------------------------------------------------------------------------
def feuille_unit(wb, S):
    ws = wb.create_sheet(u"Unit economics")
    ws.sheet_view.showGridLines = False
    for col, w in zip("ABCDE", (2, 54, 15, 11, 56)):
        ws.column_dimensions[col].width = w
    ws.cell(row=2, column=2, value=u"Unit economics").font = F_TITRE
    ws.cell(row=3, column=2, value=u"Ce que rapporte un client, heure par heure.").font = F_SOUS

    R, Y, U = REF, HYP, {}
    r = _bloc(ws, 5, u"Tarification et rendement horaire")
    r = _ligne(ws, r, "ca_jour", u"Euros facturés par jour en tant que consultant",
               u"=%s/%s" % (R["prix_depl"], R["jours_depl"]), u"€/j", FMT_EUR2,
               u"prix_déploiement / jours_déploiement", U)
    r = _ligne(ws, r, "ca_heure", u"Euros par heure facturée en tant que consultant",
               u"=%s/%s" % (R["prix_depl"], Y["h_par_auto"]), u"€/h", FMT_EUR2,
               u"prix_déploiement / heures_par_automatisation", U)
    r = _ligne(ws, r, "net_heure", u"Euros/h net IR travaillés en tant que consultant IA",
               u"=%s*%s" % (U["ca_heure"], R["net_ir_cons"]), u"€/h", FMT_EUR2,
               u"CA_horaire × taux_net_IR", U)
    r = _ligne(ws, r, "net_jour", u"Euros/jour net IR",
               u"=%s*%s" % (U["ca_jour"], R["net_ir_cons"]), u"€/j", FMT_EUR2,
               u"CA_journalier × taux_net_IR", U)
    r += 1

    r = _bloc(ws, r, u"Par automatisation vendue")
    r = _ligne(ws, r, None, u"Euros par automatisation de base", u"=%s" % R["prix_depl"], u"€", FMT_EUR,
               u"paramètre", U)
    r = _ligne(ws, r, None, u"Heures travaillées par automatisation de base", u"=%s" % Y["h_par_auto"],
               u"h", FMT_H, u"jours_déploiement × heures_par_jour", U)
    r = _ligne(ws, r, "h_prosp_vente", u"Heures de prospection amorties par vente",
               u"=%s/%s" % (R["h_diag"], R["conv"]), u"h", FMT_NB1,
               u"durée_diagnostic / taux_conversion", U)
    r = _ligne(ws, r, "h_par_client", u"Heures totales investies par client",
               u"=%s/%s" % (Y["h_total_an"], Y["clients_an"]), u"h", FMT_NB1,
               u"heures_annuelles / clients_annuels", U)
    r = _ligne(ws, r, None, u"Euros de MRR mensuel par automatisation", u"=%s" % R["prix_abo"],
               u"€/mois", FMT_EUR, u"paramètre", U)
    r += 1

    r = _bloc(ws, r, u"Valeur du client")
    r = _ligne(ws, r, "mrr_an_client", u"Euros de MRR annuel par client", u"=%s*12" % R["prix_abo"],
               u"€/an", FMT_EUR, u"prix_abonnement × 12", U)
    r = _ligne(ws, r, "mois_payes", u"Mois réellement payés sur 12 (avec churn)",
               u"=%s*(1-%s^12)/%s" % (Y["survie"], Y["survie"], Y["churn"]), u"mois", FMT_NB1,
               u"somme des probabilités de survie sur 12 mois", U)
    r = _ligne(ws, r, "mrr_an1_churn", u"MRR encaissé la première année (avec churn)",
               u"=%s*%s" % (R["prix_abo"], U["mois_payes"]), u"€", FMT_EUR,
               u"prix_abonnement × mois_payés", U)
    r = _ligne(ws, r, "rev_client_an1", u"Euros de revenu par client la première année",
               u"=%s+%s" % (R["prix_depl"], U["mrr_an_client"]), u"€", FMT_EUR,
               u"déploiement + 12 mois d'abonnement", U)
    r = _ligne(ws, r, "ca_h_an1", u"Euros/h facturés au client la première année",
               u"=%s/%s" % (U["rev_client_an1"], U["h_par_client"]), u"€/h", FMT_EUR2,
               u"revenu_client_an1 / heures_par_client", U)
    r = _ligne(ws, r, "ca_h_an1_hm", u"Euros/h la première année, hors marketing",
               u"=%s/(%s+%s)" % (U["rev_client_an1"], Y["h_par_auto"], U["h_prosp_vente"]), u"€/h", FMT_EUR2,
               u"revenu_client_an1 / (implémentation + prospection)", U)
    r = _ligne(ws, r, "net_h_an1", u"Euros/h net IR la première année",
               u"=%s*%s" % (U["ca_h_an1"], R["net_ir_cons"]), u"€/h", FMT_EUR2,
               u"CA_horaire_an1 × taux_net_IR", U)
    r = _ligne(ws, r, "ltv", u"LTV brute (déploiement + abonnements)",
               u"=%s+%s/%s" % (R["prix_depl"], R["prix_abo"], Y["churn"]), u"€", FMT_EUR,
               u"prix_déploiement + prix_abonnement / churn", U)
    r = _ligne(ws, r, "ltv_nette", u"LTV nette d'impôt",
               u"=%s*%s" % (U["ltv"], R["net_ir_cons"]), u"€", FMT_EUR,
               u"LTV_brute × taux_net_IR", U)
    r = _ligne(ws, r, "ltv_heure", u"LTV nette par heure investie",
               u"=%s/%s" % (U["ltv_nette"], U["h_par_client"]), u"€/h", FMT_EUR2,
               u"LTV_nette / heures_par_client", U)
    r = _ligne(ws, r, None, u"Durée de vie moyenne d'un abonnement", u"=%s" % Y["duree_vie"],
               u"mois", FMT_NB1, u"1 / churn_mensuel", U)
    r = _ligne(ws, r, None, u"Churn mensuel équivalent", u"=%s" % Y["churn"], u"%", '0.00 %',
               u"1 − rétention^(1/12)", U)
    r += 1

    # Comparatif €/h — table + graphique
    rc = r
    ws.cell(row=rc, column=2, value=u"Comparatif : combien vaut une heure").font = F_SECTION
    rc += 1
    comp = [
        (u"Salariat (heure de présence)", S["ng_eur_h"]),
        (u"Salariat (heure de travail réel)", S["ng_eur_h_cer"]),
        (u"Implémentation facturée, net IR", U["net_heure"]),
        (u"Consultant première année, net IR", U["net_h_an1"]),
        (u"Au plateau, net IR", u"%s/%s" % (HYP["plateau_net"], HYP["h_total_an"])),
    ]
    r0 = rc
    for lbl, ref in comp:
        ws.cell(row=rc, column=2, value=lbl).font = F_LABEL
        c = ws.cell(row=rc, column=3, value=u"=%s" % ref)
        c.number_format = FMT_EUR2
        c.font = F_VAL
        c.alignment = Alignment(horizontal="right")
        c.border = BAS
        rc += 1

    bar = BarChart()
    bar.type = "bar"
    bar.title = u"Rendement net d'impôt par heure travaillée"
    bar.height, bar.width = 9, 15
    bar.y_axis.numFmt = u'#,##0.00 "€"'
    bar.add_data(Reference(ws, min_col=3, min_row=r0, max_row=rc - 1), titles_from_data=False)
    bar.set_categories(Reference(ws, min_col=2, min_row=r0, max_row=rc - 1))
    bar.series[0].graphicalProperties.solidFill = TEAL
    ws.add_chart(bar, "G%d" % r0)
    return ws, U


# ---------------------------------------------------------------------------
# Feuille 8 — Jalons
# ---------------------------------------------------------------------------
def feuille_jalons(wb):
    ws = wb.create_sheet(u"Jalons")
    ws.sheet_view.showGridLines = False
    for col, w in zip("ABCDEF", (2, 50, 22, 15, 12, 18)):
        ws.column_dimensions[col].width = w
    ws.cell(row=2, column=2, value=u"Jalons et seuils").font = F_TITRE
    ws.cell(row=3, column=2,
            value=u"Date de franchissement de chaque seuil, cherchée dans la feuille MRR mensuel.").font = F_SOUS

    hr = 5
    for col, lib in ((2, u"Jalon"), (3, u"Condition"), (4, u"Date"), (5, u"Rang"), (6, u"MRR à cette date")):
        c = ws.cell(row=hr, column=col, value=lib)
        c.font = F_H
        c.fill = FILL_H
        c.alignment = Alignment(horizontal="center")
        c.border = BORD

    dat = u"%s!$A$%d:$A$%d" % (M, LIG_M0, LIG_M1)
    def rg(col):
        return u"%s!$%s$%d:$%s$%d" % (M, col, LIG_M0, col, LIG_M1)

    R, Y = REF, HYP
    jalons = [
        (u"Le MRR dépasse le CA de déploiement", u"MRR >= CA déploiement",
         u"(%s>=%s)" % (rg("F"), rg("E"))),
        (u"Le net consultant couvre les dépenses", u"net consultant >= dépenses",
         u"(%s>=%s)" % (rg("J"), R["depenses"])),
        (u"MRR à 1 000 €/mois", u"MRR >= 1 000 €", u"(%s>=1000)" % rg("F")),
        (u"Le net consultant égale le salaire net IR", u"net consultant >= salaire net",
         u"(%s>=%s)" % (rg("J"), Y["sal_net_mois"])),
        (u"MRR à 5 000 €/mois", u"MRR >= 5 000 €", u"(%s>=5000)" % rg("F")),
        (u"Le MRR net seul couvre les dépenses", u"net MRR >= dépenses",
         u"(%s>=%s)" % (rg("H"), R["depenses"])),
        (u"Le MRR net seul remplace le salaire", u"net MRR >= salaire net",
         u"(%s>=%s)" % (rg("H"), Y["sal_net_mois"])),
        (u"MRR à 10 000 €/mois", u"MRR >= 10 000 €", u"(%s>=10000)" % rg("F")),
    ]
    r = hr + 1
    for label, cond_txt, cond in jalons:
        ws.cell(row=r, column=2, value=label).font = F_LABEL
        ws.cell(row=r, column=3, value=cond_txt).font = F_NOTE
        # Date brute + format de cellule : "aaaa" n'existe pas dans Google Sheets,
        # et TEXT() dépend de la locale. On renvoie la date, on la met en forme.
        cd = ws.cell(row=r, column=4,
                     value=u'=IFERROR(INDEX(%s,MATCH(TRUE,%s,0)),"hors horizon")' % (dat, cond))
        cd.number_format = u'mmmm yyyy'
        ws.cell(row=r, column=5,
                value=u'=IFERROR("M+"&MATCH(TRUE,%s,0),"—")' % cond)
        ws.cell(row=r, column=6,
                value=u'=IFERROR(INDEX(%s,MATCH(TRUE,%s,0)),"—")' % (rg("F"), cond))
        ws.cell(row=r, column=6).number_format = FMT_EUR
        for col in range(2, 7):
            c = ws.cell(row=r, column=col)
            c.border = BAS
            if col >= 4:
                c.alignment = Alignment(horizontal="right")
                c.font = F_VAL
        r += 1

    r += 1
    ws.cell(row=r, column=2,
            value=u"Les formules MATCH(TRUE;…;0) sont matricielles. Google Sheets les évalue directement ;").font = F_NOTE
    ws.cell(row=r + 1, column=2,
            value=u"dans Excel, valider par Ctrl+Maj+Entrée si une version antérieure à 2021 est utilisée.").font = F_NOTE
    return ws


# ---------------------------------------------------------------------------
# Feuille 9 — Sensibilité
# ---------------------------------------------------------------------------
def _mrr_formule(nb_mois, diag, conv, ret, prix):
    """MRR au bout de nb_mois, forme fermée d'une suite arithmético-géométrique."""
    ch = u"(1-%s^(1/12))" % ret
    n = u"((%s*(%s/5)*%s)/12)" % (diag, REF["jours_an"], conv)
    return u"=%s*(1-(1-%s)^%d)/%s*%s" % (n, ch, nb_mois, ch, prix)


def feuille_sensibilite(wb):
    ws = wb.create_sheet(u"Sensibilité")
    ws.sheet_view.showGridLines = False
    for col in "ABCDEFGH":
        ws.column_dimensions[col].width = 16
    ws.column_dimensions['A'].width = 2
    ws.column_dimensions['B'].width = 22

    ws.cell(row=2, column=2, value=u"Analyse de sensibilité").font = F_TITRE
    ws.cell(row=3, column=2,
            value=u"MRR atteint au 37ᵉ mois selon deux couples d'hypothèses.").font = F_SOUS

    R = REF
    # --- Matrice 1 : diagnostics × conversion
    r0 = 6
    ws.cell(row=r0 - 1, column=2, value=u"Levier volume — diagnostics/semaine × taux de conversion").font = F_SECTION
    diag_vals = [0.5, 0.75, 1, 1.5, 2, 3]
    conv_vals = [0.20, 0.30, 0.40, 0.50, 0.60, 0.75]
    ws.cell(row=r0, column=2, value=u"Diag. \\ Conversion").font = F_H
    ws.cell(row=r0, column=2).fill = FILL_H2
    for j, cv in enumerate(conv_vals):
        c = ws.cell(row=r0, column=3 + j, value=cv)
        c.number_format = FMT_PCT0
        c.font = F_H
        c.fill = FILL_H
        c.alignment = Alignment(horizontal="center")
    for i, dv in enumerate(diag_vals):
        c = ws.cell(row=r0 + 1 + i, column=2, value=dv)
        c.number_format = u'0.00 "/sem"'
        c.font = F_VAL
        c.fill = FILL_TOT
        c.alignment = Alignment(horizontal="right")
        for j, cv in enumerate(conv_vals):
            cc = ws.cell(row=r0 + 1 + i, column=3 + j,
                         value=_mrr_formule(NB_MOIS, u"$B%d" % (r0 + 1 + i),
                                            u"%s$%d" % (get_column_letter(3 + j), r0),
                                            R["retention"], R["prix_abo"]))
            cc.number_format = FMT_EUR
            cc.alignment = Alignment(horizontal="right")
            cc.border = BORD
    ws.conditional_formatting.add(
        "C%d:H%d" % (r0 + 1, r0 + len(diag_vals)),
        ColorScaleRule(start_type='min', start_color='F0F7FF',
                       mid_type='percentile', mid_value=50, mid_color='8ABEF8',
                       end_type='max', end_color='0071E3'))

    # --- Matrice 2 : prix × rétention
    r1 = r0 + len(diag_vals) + 4
    ws.cell(row=r1 - 1, column=2, value=u"Levier valeur — prix de l'abonnement × taux de rétention").font = F_SECTION
    prix_vals = [95, 145, 185, 245, 320, 450]
    ret_vals = [0.60, 0.70, 0.80, 0.85, 0.92, 0.97]
    ws.cell(row=r1, column=2, value=u"Prix \\ Rétention").font = F_H
    ws.cell(row=r1, column=2).fill = FILL_H2
    for j, rv in enumerate(ret_vals):
        c = ws.cell(row=r1, column=3 + j, value=rv)
        c.number_format = FMT_PCT0
        c.font = F_H
        c.fill = FILL_H
        c.alignment = Alignment(horizontal="center")
    for i, pv in enumerate(prix_vals):
        c = ws.cell(row=r1 + 1 + i, column=2, value=pv)
        c.number_format = FMT_EUR
        c.font = F_VAL
        c.fill = FILL_TOT
        c.alignment = Alignment(horizontal="right")
        for j, rv in enumerate(ret_vals):
            cc = ws.cell(row=r1 + 1 + i, column=3 + j,
                         value=_mrr_formule(NB_MOIS, R["diag_sem"], R["conv"],
                                            u"%s$%d" % (get_column_letter(3 + j), r1),
                                            u"$B%d" % (r1 + 1 + i)))
            cc.number_format = FMT_EUR
            cc.alignment = Alignment(horizontal="right")
            cc.border = BORD
    ws.conditional_formatting.add(
        "C%d:H%d" % (r1 + 1, r1 + len(prix_vals)),
        ColorScaleRule(start_type='min', start_color='F0F7FF',
                       mid_type='percentile', mid_value=50, mid_color='8ABEF8',
                       end_type='max', end_color='0071E3'))

    r2 = r1 + len(prix_vals) + 3
    ws.cell(row=r2, column=2,
            value=u"Lecture : chaque cellule recalcule le MRR du 37ᵉ mois en ne changeant que les deux").font = F_NOTE
    ws.cell(row=r2 + 1, column=2,
            value=u"variables de la matrice. Les autres paramètres restent ceux de la feuille Paramètres.").font = F_NOTE
    return ws


# ---------------------------------------------------------------------------
# Feuille 10 — Scénarios
# ---------------------------------------------------------------------------
def feuille_scenarios(wb):
    ws = wb.create_sheet(u"Scénarios")
    ws.sheet_view.showGridLines = False
    for col, w in zip("ABCDEFGH", (2, 16, 15, 15, 15, 15, 16, 18)):
        ws.column_dimensions[col].width = w
    ws.cell(row=2, column=2, value=u"Scénarios").font = F_TITRE
    ws.cell(row=3, column=2,
            value=u"Cinq trajectoires. Les hypothèses de chaque ligne sont modifiables directement ici.").font = F_SOUS

    hr = 5
    entetes = [u"Scénario", u"Diagnostics/sem", u"Conversion", u"Rétention", u"Prix abo",
               u"Clients au 37ᵉ mois", u"MRR au 37ᵉ mois", u"Net moyen/mois"]
    for j, lib in enumerate(entetes):
        c = ws.cell(row=hr, column=2 + j, value=lib)
        c.font = F_H
        c.fill = FILL_H
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BORD
    ws.row_dimensions[hr].height = 30

    R = REF
    lignes = [
        (u"Pessimiste", 1, 0.25, 0.65, 148),
        (u"Prudent", 1, 0.375, 0.75, 185),
        (u"Référence", None, None, None, None),
        (u"Optimiste", 1.5, 0.60, 0.90, 185),
        (u"Agressif", 2.5, 0.65, 0.92, 231),
    ]
    r = hr + 1
    for nom, d, cv, rt, pr in lignes:
        ws.cell(row=r, column=2, value=nom).font = F_VAL
        vals = [
            (3, d, u"=%s" % R["diag_sem"], FMT_NB2),
            (4, cv, u"=%s" % R["conv"], FMT_PCT0),
            (5, rt, u"=%s" % R["retention"], FMT_PCT0),
            (6, pr, u"=%s" % R["prix_abo"], FMT_EUR),
        ]
        for col, v, formule_ref, fmt in vals:
            c = ws.cell(row=r, column=col, value=(v if v is not None else formule_ref))
            c.number_format = fmt
            c.alignment = Alignment(horizontal="right")
            c.fill = FILL_PARAM if v is not None else FILL_TOT
            c.border = BORD
        ch = u"(1-$E%d^(1/12))" % r
        n = u"(($C%d*(%s/5)*$D%d)/12)" % (r, R["jours_an"], r)
        # clients au terme : suite arithmetico-geometrique, forme fermee
        ws.cell(row=r, column=7,
                value=u"=%s*(1-(1-%s)^%d)/%s" % (n, ch, NB_MOIS, ch)).number_format = FMT_NB1
        ws.cell(row=r, column=8, value=u"=G%d*$F%d" % (r, r)).number_format = FMT_EUR
        # clients moyens sur l'horizon, puis net consultant moyen par mois
        moy = u"(%s/%s)*(1-(1-(1-%s)^%d)/(%d*%s))" % (n, ch, ch, NB_MOIS, NB_MOIS, ch)
        ws.cell(row=r, column=9,
                value=u"=(%s*$F%d+%s*%s)*%s" % (moy, r, n, R["prix_depl"], R["net_ir_cons"])
                ).number_format = FMT_EUR
        for col in range(2, 10):
            ws.cell(row=r, column=col).border = BAS
        ws.cell(row=r, column=8).font = Font(name="Calibri", size=11, bold=True, color=TEAL)
        r += 1

    ws.column_dimensions['I'].width = 18

    ch1 = BarChart()
    ch1.type = "col"
    ch1.title = u"MRR au 37ᵉ mois selon le scénario"
    ch1.height, ch1.width = 9, 20
    ch1.y_axis.numFmt = u'#,##0 "€"'
    ch1.add_data(Reference(ws, min_col=8, min_row=hr, max_row=hr + 5), titles_from_data=True)
    ch1.set_categories(Reference(ws, min_col=2, min_row=hr + 1, max_row=hr + 5))
    ch1.series[0].graphicalProperties.solidFill = TEAL
    ws.add_chart(ch1, "B14")

    ch2 = BarChart()
    ch2.type = "col"
    ch2.title = u"Net consultant moyen par mois"
    ch2.height, ch2.width = 9, 20
    ch2.y_axis.numFmt = u'#,##0 "€"'
    ch2.add_data(Reference(ws, min_col=9, min_row=hr, max_row=hr + 5), titles_from_data=True)
    ch2.set_categories(Reference(ws, min_col=2, min_row=hr + 1, max_row=hr + 5))
    ch2.series[0].graphicalProperties.solidFill = BLUE
    ws.add_chart(ch2, "L14")

    ws.cell(row=33, column=2,
            value=u"Les cellules à fond crème sont modifiables : chaque scénario est indépendant.").font = F_NOTE
    ws.cell(row=34, column=2,
            value=u"La ligne « Référence » recopie automatiquement la feuille Paramètres.").font = F_NOTE
    return ws


# ---------------------------------------------------------------------------
# Feuille 3 (position) — Résultats clés / tableau de bord
# ---------------------------------------------------------------------------
def feuille_dashboard(wb, S, U):
    ws = wb.create_sheet(u"Résultats clés")
    ws.sheet_view.showGridLines = False
    for col, w in zip("ABCDEFGH", (2, 46, 17, 4, 46, 17, 3, 3)):
        ws.column_dimensions[col].width = w

    ws.cell(row=2, column=2, value=u"Résultats clés").font = F_TITRE
    ws.cell(row=3, column=2,
            value=u"Synthèse de l'étude. Toutes les valeurs découlent de la feuille Paramètres.").font = F_SOUS

    R, Y = REF, HYP
    dernier_mrr = u"%s!$F$%d" % (M, LIG_M1)
    dernier_clients = u"%s!$D$%d" % (M, LIG_M1)
    dernier_rev = u"%s!$L$%d" % (M, LIG_M1)
    cum_ca = u"%s!$N$%d" % (M, LIG_M1)
    cum_ep = u"%s!$O$%d" % (M, LIG_M1)
    an2 = u"'Synthèse annuelle'!$%s$%d"

    blocs = [
        (u"Sur l'horizon complet (37 mois)", [
            (u"MRR au dernier mois projeté", u"=%s" % dernier_mrr, FMT_EUR),
            (u"ARR au dernier mois projeté", u"=%s*12" % dernier_mrr, FMT_EUR),
            (u"Clients actifs au dernier mois", u"=%s" % dernier_clients, FMT_NB1),
            (u"Revenu total net du dernier mois", u"=%s" % dernier_rev, FMT_EUR),
            (u"CA total cumulé", u"=%s" % cum_ca, FMT_EUR),
            (u"Net consultant cumulé", u"=%s*%s" % (cum_ca, R["net_ir_cons"]), FMT_EUR),
            (u"Épargne cumulée", u"=%s" % cum_ep, FMT_EUR),
        ]),
        (u"Charge de travail", [
            (u"Heures annuelles sur le business", u"=%s" % Y["h_total_an"], FMT_H0),
            (u"Heures hebdomadaires", u"=%s" % Y["h_hebdo"], FMT_H),
            (u"Jours équivalents travaillés par semaine", u"=%s" % Y["j_eq_hebdo"], FMT_NB2),
            (u"Taux de charge (charge / capacité)", u"=%s" % Y["taux_charge"], FMT_PCT),
            (u"Part du temps à prospecter", u"=%s" % Y["pct_prospect"], FMT_PCT),
            (u"Charge combinée avec le salariat", u"=%s" % S["eng_hebdo"], FMT_H),
        ]),
        (u"Entonnoir annuel", [
            (u"Diagnostics gratuits par an", u"=%s" % Y["diag_an"], FMT_NB1),
            (u"Automatisations vendues par semaine", u"=%s" % Y["auto_sem"], FMT_NB2),
            (u"Automatisations vendues par an", u"=%s" % Y["clients_an"], FMT_NB1),
            (u"Nouveaux clients par mois", u"=%s" % Y["nouveaux_mois"], FMT_NB2),
            (u"CA de déploiement annuel", u"=%s" % Y["ca_depl_an"], FMT_EUR),
        ]),
    ]
    blocs2 = [
        (u"Valeur d'un client", [
            (u"Euros facturés par jour", u"=%s" % U["ca_jour"], FMT_EUR2),
            (u"Euros par heure facturée", u"=%s" % U["ca_heure"], FMT_EUR2),
            (u"Euros/h net IR (implémentation)", u"=%s" % U["net_heure"], FMT_EUR2),
            (u"Revenu par client la première année", u"=%s" % U["rev_client_an1"], FMT_EUR),
            (u"Euros/h net IR la première année", u"=%s" % U["net_h_an1"], FMT_EUR2),
            (u"LTV nette par client", u"=%s" % U["ltv_nette"], FMT_EUR),
            (u"Durée de vie d'un abonnement", u"=%s" % Y["duree_vie"], FMT_NB1),
        ]),
        (u"Deuxième année", [
            (u"Clients en fin d'exercice", u"=" + an2 % ("L", ANN_R0 + 1), FMT_NB1),
            (u"MRR généré sur l'année", u"=" + an2 % ("D", ANN_R0 + 1), FMT_EUR),
            (u"MRR net d'IR", u"=" + (an2 % ("D", ANN_R0 + 1)) + u"*" + R["net_ir_cons"], FMT_EUR),
            (u"Net consultant mensuel moyen", u"=" + (an2 % ("G", ANN_R0 + 1)) + u"/12", FMT_EUR),
            (u"Revenu mensuel consultant + salariat", u"=" + (an2 % ("I", ANN_R0 + 1)) + u"/12", FMT_EUR),
            (u"Liquidités mensuelles après dépenses", u"=" + (an2 % ("K", ANN_R0 + 1)) + u"/12", FMT_EUR),
            (u"Liquidités ajoutées sur l'année", u"=" + an2 % ("K", ANN_R0 + 1), FMT_EUR),
            (u"Euros/h équivalent agent IA", u"=" + an2 % ("O", ANN_R0 + 1), FMT_EUR2),
        ]),
        (u"Régime permanent", [
            (u"Clients au plateau", u"=%s" % Y["plateau_clients"], FMT_NB1),
            (u"MRR au plateau", u"=%s" % Y["plateau_mrr"], FMT_EUR),
            (u"CA annuel au plateau", u"=%s" % Y["plateau_ca"], FMT_EUR),
            (u"Net IR annuel au plateau", u"=%s" % Y["plateau_net"], FMT_EUR),
            (u"Euros/h net au plateau",
             u"=%s/%s" % (Y["plateau_net"], Y["h_total_an"]), FMT_EUR2),
        ]),
    ]

    def ecrire(colonne_label, colonne_valeur, blocs, depart):
        r = depart
        for titre, items in blocs:
            ws.cell(row=r, column=colonne_label, value=titre).font = F_SECTION
            r += 1
            for lbl, formule, fmt in items:
                ws.cell(row=r, column=colonne_label, value=lbl).font = F_LABEL
                c = ws.cell(row=r, column=colonne_valeur, value=formule)
                c.number_format = fmt
                c.font = F_VAL
                c.fill = FILL_KPI
                c.alignment = Alignment(horizontal="right")
                c.border = BORD
                ws.cell(row=r, column=colonne_label).border = BAS
                r += 1
            r += 1
        return r

    fin1 = ecrire(2, 3, blocs, 5)
    fin2 = ecrire(5, 6, blocs2, 5)
    return ws


# ---------------------------------------------------------------------------
# Assemblage
# ---------------------------------------------------------------------------
def main():
    wb = Workbook()
    wb.remove(wb.active)

    feuille_lisezmoi(wb)
    feuille_parametres(wb)
    ws_dash_placeholder = None       # créé après, puis réordonné
    feuille_hypotheses(wb)
    ws_temps, S = feuille_temps(wb)
    ws_unit, U = feuille_unit(wb, S)
    feuille_mrr(wb)
    feuille_annuelle(wb)
    feuille_jalons(wb)
    feuille_sensibilite(wb)
    feuille_scenarios(wb)
    feuille_dashboard(wb, S, U)

    # ordre logique des onglets
    ordre = [u"Lisez-moi", u"Paramètres", u"Résultats clés", u"Hypothèses", u"Temps & capacité",
             u"Unit economics", u"MRR mensuel", u"Synthèse annuelle", u"Jalons",
             u"Sensibilité", u"Scénarios"]
    wb._sheets = [wb[nom] for nom in ordre]

    couleurs = {u"Paramètres": ORANGE, u"Résultats clés": BLUE, u"MRR mensuel": TEAL,
                u"Synthèse annuelle": INDIGO, u"Scénarios": PURPLE, u"Sensibilité": PURPLE}
    for nom in ordre:
        wb[nom].sheet_properties.tabColor = couleurs.get(nom, "D2D2D7")

    dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "consultant-agent-ia-v2.xlsx")
    wb.save(dest)
    taille = os.path.getsize(dest)
    print(u"Classeur écrit : %s (%.1f Ko, %d onglets)" % (dest, taille / 1024.0, len(ordre)))
    return dest


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
