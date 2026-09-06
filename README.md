# Consultant agent IA — étude MRR 2027-2030

Étude de rentabilité d'une activité de **consultant en déploiement d'agents IA**
adossée à un revenu récurrent, projetée mois par mois de **01/2027 à 01/2030**.

Le modèle : un diagnostic gratuit par semaine → converti une fois sur deux en
déploiement d'agent facturé **997 €** → suivi d'un abonnement de **185 €/mois**
tant que l'agent reste en production. Si la semaine de test n'est pas
concluante : au revoir, chiffre d'affaires 0 €.

## Contenu

| Fichier | Rôle |
|---|---|
| `index.html` | L'étude complète, interactive, en une page |
| `assets/model.js` | Moteur de calcul (fonctions pures, aucune dépendance) |
| `assets/charts.js` | Micro-bibliothèque de graphiques SVG, sans dépendance |
| `assets/app.js` | Interface : paramètres, tableaux, graphiques, persistance |
| `assets/style.css` | Design system (fond blanc, typographie système) |
| `sheets/build_gsheet.py` | Générateur du classeur Google Sheets |
| `sheets/push_to_drive.py` | Publication du classeur en Google Sheet natif |
| `sheets/consultant-agent-ia-v2.xlsx` | Classeur prêt à importer dans Drive |
| `consultant.service` | Unité systemd utilisateur du Raspberry Pi |
| `deploy-rpi.sh` | Déploiement sur Raspberry Pi |

Aucune dépendance externe, aucun CDN, aucun réseau : la page fonctionne
hors ligne, y compris ouverte directement depuis le disque.

## Utilisation

Ouvrir `index.html` dans un navigateur. Ou, pour un serveur local :

```bash
python -m http.server 8777
```

Les **22 paramètres** de la section 02 sont modifiables ; toute la page se
recalcule instantanément. Les réglages sont enregistrés dans le `localStorage`
du navigateur et rechargés à la visite suivante. Les boutons *Exporter* /
*Importer* permettent de transporter un jeu de paramètres en JSON.

## Les 16 sections

1. Modèle économique — l'offre, l'entonnoir, les deux sources de revenu
2. Paramètres — 22 variables réglables
3. Temps & capacité — salariat, marge cognitive, charge réelle
4. Unit economics — €/h, LTV, rétention
5. Tableau MRR mensuel — 37 mois ligne à ligne
6. CA & revenus mensuels — du chiffre d'affaires au revenu disponible
7. Synthèse annuelle — agrégats par exercice, cascade CA → net
8. Année 1 — l'amorçage
9. Année 2 — la bascule vers le récurrent
10. Année 3 & régime permanent — le plateau théorique
11. Comparatif €/heure — salariat contre consultant
12. Jalons & seuils — dates de franchissement
13. Sensibilité — deux matrices, levier volume et levier prix
14. Scénarios — cinq trajectoires
15. Risques & leviers
16. Annexe — toutes les formules

## Version Google Sheets

`sheets/consultant-agent-ia-v2.xlsx` reprend la même étude en **11 onglets**,
entièrement piloté par formules : la feuille *Paramètres* est la seule source
de saisie, tout le reste se recalcule.

Onglets : Lisez-moi · Paramètres · Résultats clés · Hypothèses ·
Temps & capacité · Unit economics · MRR mensuel · Synthèse annuelle ·
Jalons · Sensibilité · Scénarios.

Deux façons de l'obtenir sur Drive, dans le dossier **#Consultant + MRR** :

**1. Automatique** — depuis le Pi, où le jeton OAuth Google est déjà présent :

```bash
cd ~/consultant && ./deploy-rpi.sh --drive
```

Raspberry Pi OS applique PEP 668 : `pip install` refuse d'écrire dans le
système. L'option `--drive` crée donc un environnement virtuel dans
`~/.venvs/consultant`, y installe les dépendances Google, puis publie. Elle est
idempotente — au deuxième passage, seule la publication est rejouée.

Le script crée (ou met à jour) le Google Sheet natif `Consultant agent IA v2`,
pousse les 11 onglets **avec leurs formules vivantes**, applique les formats
et ajoute dix graphiques Google natifs. Relancer la commande met le fichier à
jour sans le dupliquer. Jeton attendu dans `~/.hermes/google_token.json`,
surchargeable par `GOOGLE_TOKEN`.

**2. Manuelle** — déposer `sheets/consultant-agent-ia-v2.xlsx` dans le dossier
Drive, puis l'ouvrir avec Google Sheets (Drive convertit le classeur en
conservant formules, mises en forme et graphiques) et le renommer
`Consultant agent IA v2`.

Pour régénérer le classeur après modification du modèle :

```bash
python sheets/build_gsheet.py
```

## Déploiement Raspberry Pi

Le Pi sert déjà le site depuis `~/consultant` sur le **port 8001**, via le
service utilisateur systemd `consultant` (`consultant.service`).
`deploy-rpi.sh` met ce déploiement à jour — il ne crée pas un second site.

```bash
curl -fsSL https://raw.githubusercontent.com/romain13240/consultant/main/deploy-rpi.sh | bash
```

Ou, si le dépôt est déjà cloné sur le Pi :

```bash
cd ~/consultant && git pull && ./deploy-rpi.sh
```

Le script met à jour les sources, réinstalle l'unité systemd utilisateur et
redémarre le service. Page servie sur `http://<ip-du-pi>:8001`.

Journal du service :

```bash
journalctl --user -u consultant -f
```

## Portée et limites

Projection déterministe, pas une prévision. La fiscalité est approchée par un
taux global unique (cotisations + impôt sur le revenu + frais d'API des agents).
L'acquisition est supposée linéaire et constante. Aucun coût fixe
d'infrastructure n'est isolé.
