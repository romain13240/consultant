# Consultant agent IA — Business plan v2

Étude financière interactive pour une activité de conseil en déploiement d’agents IA.

## Contenu

- `index.html` : étude HTML autonome, responsive, graphiques, tableau MRR 01/2027–01/2030, menu latéral et paramètres persistants via `localStorage`.
- `Consultant agent IA v2.xlsx` : classeur local avec onglets Paramètres, MRR mensuel, Synthèse annuelle, Temps & capacité.
- `build_workbook.py` : régénération du classeur.
- `push_google_sheet.py` : script de publication Google Sheets (nécessite les identifiants Google locaux).

## Déploiement Raspberry Pi

Depuis le Raspberry Pi :

```bash
git clone https://github.com/ROMAIN13240/consultant.git
cd consultant
python3 -m http.server 8001 --bind 0.0.0.0
```

Puis ouvrir `http://IP_DU_RASPBERRY_PI:8001/`.

Pour un service systemd utilisateur, adapter le chemin dans `consultant.service`, puis :

```bash
mkdir -p ~/.config/systemd/user
cp consultant.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now consultant.service
```

## Hypothèses importantes

Le taux « part du CA restant net IR » est un taux de scénario qui regroupe impôts, cotisations, coûts API et frais. Il est modifiable dans le menu latéral. Les horaires Naval Group sont également paramétrables ; la valeur initiale suppose 4 jours sur site par semaine, 1 jour télétravaillé et 7 heures réelles par jour.
