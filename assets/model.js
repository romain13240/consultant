/* ============================================================================
   model.js — Moteur de calcul du business plan
   « Consultant déploiement d'agents IA » — Déploiement + MRR
   ----------------------------------------------------------------------------
   Aucune dépendance externe. Fonctions pures : PARAMS -> RESULTATS.
   ========================================================================== */
(function (global) {
  'use strict';

  /* --------------------------------------------------------------------------
     1. DÉFINITION DES PARAMÈTRES
     Chaque paramètre est éditable dans l'UI et persisté en localStorage.
     ------------------------------------------------------------------------ */
  const PARAM_GROUPS = [
    {
      id: 'offre',
      titre: 'Offre & tarification',
      icone: '💶',
      desc: "Le prix de la prestation ponctuelle et celui de l'abonnement récurrent.",
      params: [
        { key: 'prixAbonnementMensuel', label: "Prix abonnement mensuel (MRR / client)", unit: '€/mois', def: 185, min: 0, max: 900, step: 5, dec: 0,
          help: "Facturé chaque mois tant que le client garde l'agent en production. C'est la brique qui compose le MRR." },
        { key: 'prixDeploiement', label: "Prix prestation de déploiement", unit: '€', def: 997, min: 0, max: 9000, step: 1, dec: 0,
          help: "Ticket d'entrée facturé une seule fois, après la semaine de test concluante." },
        { key: 'joursDeploiement', label: "Jours de travail par déploiement", unit: 'j', def: 2, min: 0.25, max: 15, step: 0.25, dec: 2,
          help: "Temps d'implémentation réel d'un agent (ex. OCR devis -> base de données)." },
      ],
    },
    {
      id: 'acquisition',
      titre: 'Acquisition commerciale',
      icone: '🎯',
      desc: "Le moteur d'entrée : diagnostics gratuits, taux de transformation, effort marketing.",
      params: [
        { key: 'diagnosticsParSemaine', label: "Diagnostics gratuits par semaine", unit: '/sem', def: 1, min: 0, max: 15, step: 0.25, dec: 2,
          help: "Offre d'appel : audit gratuit du process à automatiser. Le volume de diagnostics pilote tout l'entonnoir." },
        { key: 'heuresDiagnostic', label: "Durée d'un diagnostic", unit: 'h', def: 1, min: 0.25, max: 8, step: 0.25, dec: 2,
          help: "Temps consommé par diagnostic, converti ou non. C'est un coût commercial sec." },
        { key: 'tauxConversion', label: "Taux de conversion diagnostic → déploiement", unit: '%', def: 50, min: 0, max: 100, step: 1, dec: 0,
          help: "Part des diagnostics qui débouchent sur un déploiement payé. Si NOK après la semaine de test : CA = 0 €." },
        { key: 'joursMarketingParSemaine', label: "Jours de marketing / prospection par semaine", unit: 'j/sem', def: 1, min: 0, max: 5, step: 0.25, dec: 2,
          help: "Contenu, réseau, démarchage : le carburant qui alimente les diagnostics." },
        { key: 'tauxRetentionAnnuel', label: "Taux de rétention annuel des abonnements", unit: '%', def: 85, min: 0, max: 100, step: 1, dec: 0,
          help: "Part des clients encore abonnés 12 mois plus tard. Converti en churn mensuel équivalent." },
      ],
    },
    {
      id: 'temps',
      titre: 'Temps & capacité',
      icone: '⏱️',
      desc: "Le budget-temps disponible pour l'activité de consultant, en parallèle du salariat.",
      params: [
        { key: 'joursTravaillesAn', label: "Jours travaillés par an (base 5 j/semaine)", unit: 'j/an', def: 208, min: 100, max: 300, step: 1, dec: 0,
          help: "Référence de calendrier de l'activité. 208 j = 41,6 semaines de 5 jours." },
        { key: 'heuresParJour', label: "Heures de travail par jour", unit: 'h/j', def: 7, min: 1, max: 14, step: 0.5, dec: 1,
          help: "Base de conversion jours ↔ heures pour toutes les métriques." },
        { key: 'heuresDispoParJourAgentIA', label: "Heures/jour réellement disponibles pour l'agent IA", unit: 'h/j', def: 3, min: 0.5, max: 12, step: 0.25, dec: 2,
          help: "Capacité réelle, hors salariat et vie perso. Comparée à la charge générée par le modèle." },
      ],
    },
    {
      id: 'salariat',
      titre: 'Salariat Naval Group',
      icone: '🏢',
      desc: "Le socle de revenu et le temps qu'il consomme réellement.",
      params: [
        { key: 'salaireNetMensuelNG', label: "Salaire mensuel net d'impôt (après IR)", unit: '€/mois', def: 3400, min: 0, max: 12000, step: 50, dec: 0,
          help: "Montant réellement disponible chaque mois, prélèvement à la source déjà déduit." },
        { key: 'joursNGParSemaine', label: "Jours travaillés par semaine (temps partiel)", unit: 'j/sem', def: 4, min: 1, max: 6, step: 0.5, dec: 1,
          help: "Contrat à temps partiel : base du calcul des heures de présence." },
        { key: 'heuresPresenceParJourNG', label: "Heures de présence par jour", unit: 'h/j', def: 8, min: 1, max: 14, step: 0.5, dec: 1,
          help: "Temps de présence contractuel, badgeuse à badgeuse." },
        { key: 'heuresCerebralParJourNG', label: "Heures de travail cérébral réel par jour", unit: 'h/j', def: 3, min: 0, max: 12, step: 0.25, dec: 2,
          help: "Temps de production intellectuelle effective. L'écart avec la présence mesure la marge cognitive disponible." },
        { key: 'semainesNGParAn', label: "Semaines travaillées par an", unit: 'sem/an', def: 44, min: 30, max: 52, step: 1, dec: 0,
          help: "52 semaines moins congés payés et RTT." },
        { key: 'joursTeletravailParSemaine', label: "Jours de télétravail par semaine", unit: 'j/sem', def: 1, min: 0, max: 5, step: 0.5, dec: 1,
          help: "Déduits des jours de présence sur site." },
      ],
    },
    {
      id: 'fiscalite',
      titre: 'Fiscalité & train de vie',
      icone: '🧾',
      desc: "Ce qui reste réellement en poche, et ce qui en sort chaque mois.",
      params: [
        { key: 'tauxNetIRConsultant', label: "Part du CA consultant conservée (net IR)", unit: '%', def: 50, min: 10, max: 100, step: 1, dec: 0,
          help: "Taux global : cotisations sociales + impôt sur le revenu + frais d'API consommés par les agents IA. 50 % ⇒ la moitié du CA finit en revenu personnel." },
        { key: 'depensesMensuelles', label: "Dépenses personnelles mensuelles", unit: '€/mois', def: 1800, min: 0, max: 10000, step: 50, dec: 0,
          help: "Train de vie complet. Sert au calcul de la capacité d'épargne." },
      ],
    },
    {
      id: 'horizon',
      titre: 'Horizon de projection',
      icone: '📅',
      desc: "Fenêtre temporelle du tableau MRR mois par mois.",
      params: [
        { key: 'moisDebut', label: "Premier mois projeté", unit: '', def: '2027-01', type: 'month',
          help: "Démarrage de l'activité de consultant : premier diagnostic facturable." },
        { key: 'moisFin', label: "Dernier mois projeté", unit: '', def: '2030-01', type: 'month',
          help: "Fin de la projection. 01/2027 → 01/2030 = 37 mois." },
      ],
    },
  ];

  /** Liste à plat de tous les paramètres. */
  const PARAM_LIST = PARAM_GROUPS.reduce((acc, g) => acc.concat(g.params.map(p => Object.assign({ groupe: g.id }, p))), []);

  /** Dictionnaire clé -> définition. */
  const PARAM_BY_KEY = PARAM_LIST.reduce((acc, p) => { acc[p.key] = p; return acc; }, {});

  /** Jeu de paramètres par défaut. */
  function defaults() {
    const o = {};
    PARAM_LIST.forEach(p => { o[p.key] = p.def; });
    return o;
  }

  /* --------------------------------------------------------------------------
     2. UTILITAIRES DE DATE
     ------------------------------------------------------------------------ */
  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  function parseMois(s) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(s || '').trim());
    if (!m) return { annee: 2027, mois: 1 };
    return { annee: +m[1], mois: Math.min(12, Math.max(1, +m[2])) };
  }

  function indexMois(d) { return d.annee * 12 + (d.mois - 1); }

  function fromIndex(i) { return { annee: Math.floor(i / 12), mois: (i % 12) + 1 }; }

  function labelCourt(d) { return String(d.mois).padStart(2, '0') + '/' + String(d.annee).slice(2); }

  function labelLong(d) { return MOIS_COURTS[d.mois - 1] + ' ' + d.annee; }

  /* --------------------------------------------------------------------------
     3. MOTEUR PRINCIPAL
     ------------------------------------------------------------------------ */
  function compute(pIn) {
    const p = Object.assign(defaults(), pIn || {});

    /* --- Normalisation des taux (% -> ratio) --- */
    const tauxConv = p.tauxConversion / 100;
    const retention = Math.min(0.999999, Math.max(0, p.tauxRetentionAnnuel / 100));
    const netIRCons = p.tauxNetIRConsultant / 100;

    /* ======================================================================
       3.1 — BLOC SALARIAT (Naval Group)
       ==================================================================== */
    const salaire = {};
    // Le salaire saisi est déjà net d'impôt : aucun taux ne lui est appliqué.
    salaire.netMensuelIR = p.salaireNetMensuelNG;
    salaire.annuelNetIR = salaire.netMensuelIR * 12;

    salaire.heuresPresenceHebdo = p.joursNGParSemaine * p.heuresPresenceParJourNG;
    salaire.heuresCerebralHebdo = p.joursNGParSemaine * p.heuresCerebralParJourNG;
    salaire.heuresPresenceAnnuel = salaire.heuresPresenceHebdo * p.semainesNGParAn;
    salaire.heuresCerebralAnnuel = salaire.heuresCerebralHebdo * p.semainesNGParAn;
    salaire.joursAnnuelTempsPartiel = p.joursNGParSemaine * p.semainesNGParAn;
    salaire.joursSurSiteAnnuel = Math.max(0, p.joursNGParSemaine - p.joursTeletravailParSemaine) * p.semainesNGParAn;
    salaire.heuresTravailReelParJour = p.heuresCerebralParJourNG;
    salaire.tauxIntensite = salaire.heuresPresenceAnnuel > 0
      ? salaire.heuresCerebralAnnuel / salaire.heuresPresenceAnnuel : 0;
    salaire.margeCognitiveAnnuelle = salaire.heuresPresenceAnnuel - salaire.heuresCerebralAnnuel;
    salaire.euroHeurePresence = salaire.heuresPresenceAnnuel > 0
      ? salaire.annuelNetIR / salaire.heuresPresenceAnnuel : 0;
    salaire.euroHeureCerebral = salaire.heuresCerebralAnnuel > 0
      ? salaire.annuelNetIR / salaire.heuresCerebralAnnuel : 0;

    /* ======================================================================
       3.2 — BLOC CAPACITÉ & CHARGE (activité consultant)
       ==================================================================== */
    const temps = {};
    temps.semainesTravailleesAn = p.joursTravaillesAn / 5;
    temps.heuresDispoAn = p.joursTravaillesAn * p.heuresParJour;              // capacité théorique plein temps
    temps.heuresCapaciteAgentIA = p.joursTravaillesAn * p.heuresDispoParJourAgentIA;

    // Entonnoir annuel en régime nominal
    temps.diagnosticsAn = p.diagnosticsParSemaine * temps.semainesTravailleesAn;
    temps.clientsAn = temps.diagnosticsAn * tauxConv;
    temps.automatisationsParSemaine = p.diagnosticsParSemaine * tauxConv;

    temps.heuresParAutomatisation = p.joursDeploiement * p.heuresParJour;
    temps.heuresDiagAn = temps.diagnosticsAn * p.heuresDiagnostic;
    temps.heuresDeploiementAn = temps.clientsAn * temps.heuresParAutomatisation;
    temps.heuresMarketingAn = p.joursMarketingParSemaine * temps.semainesTravailleesAn * p.heuresParJour;
    temps.heuresTotalAn = temps.heuresDiagAn + temps.heuresDeploiementAn + temps.heuresMarketingAn;
    temps.heuresHorsMarketingAn = temps.heuresDiagAn + temps.heuresDeploiementAn;

    temps.heuresHebdo = temps.semainesTravailleesAn > 0 ? temps.heuresTotalAn / temps.semainesTravailleesAn : 0;
    temps.chargeHeuresParJour = p.joursTravaillesAn > 0 ? temps.heuresTotalAn / p.joursTravaillesAn : 0;
    temps.tauxCharge = temps.heuresCapaciteAgentIA > 0 ? temps.heuresTotalAn / temps.heuresCapaciteAgentIA : 0;
    temps.joursEquivalentsHebdo = temps.heuresHebdo / p.heuresParJour;
    temps.joursEquivalentsAn = temps.heuresTotalAn / p.heuresParJour;
    temps.pctProspection = temps.heuresTotalAn > 0
      ? (temps.heuresDiagAn + temps.heuresMarketingAn) / temps.heuresTotalAn : 0;
    temps.pctImplementation = 1 - temps.pctProspection;

    // Temps total engagé (salariat + consultant)
    temps.heuresEngageesHebdo = salaire.heuresPresenceHebdo + temps.heuresHebdo;
    temps.heuresEngageesAn = salaire.heuresPresenceAnnuel + temps.heuresTotalAn;

    /* ======================================================================
       3.3 — UNIT ECONOMICS (par client / par automatisation)
       ==================================================================== */
    const churnMensuel = 1 - Math.pow(retention, 1 / 12);
    const survieMensuelle = 1 - churnMensuel;

    const unit = {};
    unit.churnMensuel = churnMensuel;
    unit.dureeVieMois = churnMensuel > 0 ? 1 / churnMensuel : Infinity;
    unit.prixDeploiement = p.prixDeploiement;
    unit.mrrParClient = p.prixAbonnementMensuel;

    unit.caJourConsultant = p.joursDeploiement > 0 ? p.prixDeploiement / p.joursDeploiement : 0;
    unit.caHeureConsultant = temps.heuresParAutomatisation > 0 ? p.prixDeploiement / temps.heuresParAutomatisation : 0;
    unit.netHeureConsultant = unit.caHeureConsultant * netIRCons;
    unit.netJourConsultant = unit.caJourConsultant * netIRCons;

    unit.heuresParAutomatisation = temps.heuresParAutomatisation;
    unit.heuresProspectionParVente = tauxConv > 0 ? p.heuresDiagnostic / tauxConv : 0;
    unit.heuresMarketingParVente = temps.clientsAn > 0 ? temps.heuresMarketingAn / temps.clientsAn : 0;
    unit.heuresTotalesParClient = temps.clientsAn > 0 ? temps.heuresTotalAn / temps.clientsAn : 0;

    unit.mrrAnnuelParClient = p.prixAbonnementMensuel * 12;
    // Mois réellement payés sur 12 en tenant compte du churn
    unit.moisPayesAn1 = churnMensuel > 0
      ? survieMensuelle * (1 - Math.pow(survieMensuelle, 12)) / churnMensuel : 12;
    unit.mrrAn1AvecChurn = p.prixAbonnementMensuel * unit.moisPayesAn1;

    unit.revenuClientAn1 = p.prixDeploiement + unit.mrrAnnuelParClient;         // théorique, sans churn
    unit.revenuClientAn1Reel = p.prixDeploiement + unit.mrrAn1AvecChurn;        // avec churn
    unit.ltvBrute = p.prixDeploiement + (churnMensuel > 0 ? p.prixAbonnementMensuel / churnMensuel : 0);
    unit.ltvNette = unit.ltvBrute * netIRCons;

    unit.caHeureAn1ToutCompris = unit.heuresTotalesParClient > 0 ? unit.revenuClientAn1 / unit.heuresTotalesParClient : 0;
    unit.caHeureAn1HorsMarketing = (unit.heuresParAutomatisation + unit.heuresProspectionParVente) > 0
      ? unit.revenuClientAn1 / (unit.heuresParAutomatisation + unit.heuresProspectionParVente) : 0;
    unit.netHeureAn1 = unit.caHeureAn1ToutCompris * netIRCons;
    unit.netHeureAn1HorsMarketing = unit.caHeureAn1HorsMarketing * netIRCons;

    unit.tauxNetIRConsultant = netIRCons;
    unit.ratioLtvCac = unit.heuresTotalesParClient > 0
      ? unit.ltvBrute / (unit.heuresTotalesParClient * unit.caHeureConsultant) : 0;

    /* ======================================================================
       3.4 — PROJECTION MENSUELLE
       ==================================================================== */
    const d0 = parseMois(p.moisDebut);
    const d1 = parseMois(p.moisFin);
    const i0 = indexMois(d0);
    const i1 = Math.max(i0, indexMois(d1));
    const nbMois = Math.min(240, i1 - i0 + 1);

    const nouveauxParMois = temps.clientsAn / 12;
    const salaireNetMois = salaire.netMensuelIR;

    const mois = [];
    let clients = 0;
    let cumulCaDep = 0, cumulMrr = 0, cumulCa = 0, cumulNetCons = 0, cumulRevenu = 0, cumulEpargne = 0, cumulClients = 0, cumulPerdus = 0;

    for (let k = 0; k < nbMois; k++) {
      const d = fromIndex(i0 + k);
      const clientsDebut = clients;
      const perdus = clientsDebut * churnMensuel;
      clients = clientsDebut - perdus + nouveauxParMois;

      const mrr = clients * p.prixAbonnementMensuel;
      const caDeploiement = nouveauxParMois * p.prixDeploiement;
      const caTotal = caDeploiement + mrr;

      const netIRDeploiement = caDeploiement * netIRCons;
      const netIRMrr = mrr * netIRCons;
      const netIRConsultant = caTotal * netIRCons;
      const revenuTotalNet = netIRConsultant + salaireNetMois;
      const epargne = revenuTotalNet - p.depensesMensuelles;

      cumulClients += nouveauxParMois;
      cumulPerdus += perdus;
      cumulCaDep += caDeploiement;
      cumulMrr += mrr;
      cumulCa += caTotal;
      cumulNetCons += netIRConsultant;
      cumulRevenu += revenuTotalNet;
      cumulEpargne += epargne;

      mois.push({
        idx: k,
        annee: d.annee,
        mois: d.mois,
        label: labelCourt(d),
        labelLong: labelLong(d),
        nouveauxClients: nouveauxParMois,
        clientsPerdus: perdus,
        clientsActifs: clients,
        mrr: mrr,
        caDeploiement: caDeploiement,
        caTotal: caTotal,
        netIRMrr: netIRMrr,
        netIRDeploiement: netIRDeploiement,
        netIRConsultant: netIRConsultant,
        salaireNet: salaireNetMois,
        revenuTotalNet: revenuTotalNet,
        depenses: p.depensesMensuelles,
        epargne: epargne,
        joursEquivalentsHebdo: temps.joursEquivalentsHebdo,
        heuresHebdo: temps.heuresHebdo,
        cumulCa: cumulCa,
        cumulMrr: cumulMrr,
        cumulNetConsultant: cumulNetCons,
        cumulRevenuTotal: cumulRevenu,
        cumulEpargne: cumulEpargne,
        cumulClientsSignes: cumulClients,
        cumulClientsPerdus: cumulPerdus,
      });
    }

    /* ======================================================================
       3.5 — AGRÉGATS ANNUELS
       ==================================================================== */
    const parAnnee = {};
    mois.forEach(m => {
      if (!parAnnee[m.annee]) {
        parAnnee[m.annee] = {
          annee: m.annee, nbMois: 0, caDeploiement: 0, mrr: 0, caTotal: 0,
          netIRConsultant: 0, netIRMrr: 0, salaireNet: 0, revenuTotalNet: 0,
          depenses: 0, epargne: 0, nouveauxClients: 0, clientsPerdus: 0,
          clientsFin: 0, mrrFin: 0,
        };
      }
      const a = parAnnee[m.annee];
      a.nbMois++;
      a.caDeploiement += m.caDeploiement;
      a.mrr += m.mrr;
      a.caTotal += m.caTotal;
      a.netIRConsultant += m.netIRConsultant;
      a.netIRMrr += m.netIRMrr;
      a.salaireNet += m.salaireNet;
      a.revenuTotalNet += m.revenuTotalNet;
      a.depenses += m.depenses;
      a.epargne += m.epargne;
      a.nouveauxClients += m.nouveauxClients;
      a.clientsPerdus += m.clientsPerdus;
      a.clientsFin = m.clientsActifs;
      a.mrrFin = m.mrr;
    });

    const annees = Object.keys(parAnnee).map(k => parAnnee[k]).sort((a, b) => a.annee - b.annee);
    annees.forEach(a => {
      const prorata = a.nbMois / 12;
      a.complete = a.nbMois === 12;
      a.heuresTravaillees = temps.heuresTotalAn * prorata;
      a.joursEquivalents = temps.joursEquivalentsAn * prorata;
      a.euroHeureNet = a.heuresTravaillees > 0 ? a.netIRConsultant / a.heuresTravaillees : 0;
      a.euroHeureCa = a.heuresTravaillees > 0 ? a.caTotal / a.heuresTravaillees : 0;
      a.netMensuelConsultant = a.nbMois > 0 ? a.netIRConsultant / a.nbMois : 0;
      a.netMensuelTotal = a.nbMois > 0 ? a.revenuTotalNet / a.nbMois : 0;
      a.epargneMensuelle = a.nbMois > 0 ? a.epargne / a.nbMois : 0;
      a.partMrrDansCa = a.caTotal > 0 ? a.mrr / a.caTotal : 0;
      a.euroHeure208 = temps.heuresDispoAn > 0 ? a.revenuTotalNet / (temps.heuresDispoAn * prorata) : 0;
      a.euroJour208 = p.joursTravaillesAn > 0 ? a.revenuTotalNet / (p.joursTravaillesAn * prorata) : 0;
    });

    const an1 = annees[0] || null;
    const an2 = annees[1] || null;
    const an3 = annees[2] || null;

    /* ======================================================================
       3.6 — SEUILS & JALONS
       ==================================================================== */
    const jalons = {};
    function premierMoisOu(test) {
      for (let i = 0; i < mois.length; i++) if (test(mois[i])) return mois[i];
      return null;
    }
    jalons.mrrEgaleDeploiement = premierMoisOu(m => m.mrr >= m.caDeploiement);
    jalons.netEgaleSalaire = premierMoisOu(m => m.netIRConsultant >= salaireNetMois);
    jalons.netCouvreDepenses = premierMoisOu(m => m.netIRConsultant >= p.depensesMensuelles);
    jalons.mrrNetCouvreDepenses = premierMoisOu(m => m.netIRMrr >= p.depensesMensuelles);
    // (revenu total ≥ 2 × salaire équivaut à net consultant ≥ salaire : jalon déjà couvert)
    jalons.mrrNetEgaleSalaire = premierMoisOu(m => m.netIRMrr >= salaireNetMois);
    jalons.mrr1k = premierMoisOu(m => m.mrr >= 1000);
    jalons.mrr5k = premierMoisOu(m => m.mrr >= 5000);
    jalons.mrr10k = premierMoisOu(m => m.mrr >= 10000);

    // Plateau théorique (régime permanent)
    const plateau = {};
    plateau.clients = churnMensuel > 0 ? nouveauxParMois / churnMensuel : Infinity;
    plateau.mrr = plateau.clients * p.prixAbonnementMensuel;
    plateau.caAnnuel = plateau.mrr * 12 + temps.clientsAn * p.prixDeploiement;
    plateau.netAnnuel = plateau.caAnnuel * netIRCons;
    plateau.moisPourAtteindre90 = churnMensuel > 0
      ? Math.log(1 - 0.9) / Math.log(survieMensuelle) : Infinity;

    /* ======================================================================
       3.7 — MÉTRIQUES DE SYNTHÈSE (bloc « fiches »)
       ==================================================================== */
    const dernier = mois[mois.length - 1] || null;
    const synthese = {};
    synthese.nbMoisProjetes = nbMois;
    synthese.mrrFinal = dernier ? dernier.mrr : 0;
    synthese.clientsFinal = dernier ? dernier.clientsActifs : 0;
    synthese.caCumule = dernier ? dernier.cumulCa : 0;
    synthese.netCumule = dernier ? dernier.cumulNetConsultant : 0;
    synthese.revenuCumule = dernier ? dernier.cumulRevenuTotal : 0;
    synthese.epargneCumulee = dernier ? dernier.cumulEpargne : 0;
    synthese.arrFinal = synthese.mrrFinal * 12;

    if (an1) {
      synthese.an1 = an1;
      synthese.revenuTotalAn1 = an1.revenuTotalNet;
      synthese.euroHeurePour208 = an1.euroHeure208;
      synthese.euroJourPour208 = an1.euroJour208;
    }
    if (an2) {
      synthese.an2 = an2;
      synthese.clientsAn2 = an2.clientsFin;
      synthese.mrrGenereAn2 = an2.mrr;
      synthese.mrrNetAn2 = an2.netIRMrr;
      synthese.netMrrParHeureAn2 = temps.heuresTotalAn > 0 ? an2.netIRMrr / temps.heuresTotalAn : 0;
      synthese.mensuelNetConsultantAn2 = an2.netMensuelConsultant;
      synthese.mensuelNetTotalAn2 = an2.netMensuelTotal;
      synthese.liquiditesMensuellesAn2 = an2.epargneMensuelle;
      synthese.liquiditesAnnuellesAn2 = an2.epargne;
      synthese.euroHeureAgentIAAn2 = an2.euroHeureNet;
    }

    /* ======================================================================
       3.8 — ANALYSE DE SENSIBILITÉ
       ==================================================================== */
    function mrrApres(nbMoisSim, diagSem, conv, retentionPct, prixAbo) {
      const ret = Math.min(0.999999, Math.max(0.0001, retentionPct / 100));
      const ch = 1 - Math.pow(ret, 1 / 12);
      const nAn = diagSem * (p.joursTravaillesAn / 5) * (conv / 100);
      const n = nAn / 12;
      let c = 0;
      for (let i = 0; i < nbMoisSim; i++) c = c * (1 - ch) + n;
      return c * prixAbo;
    }

    const sensDiag = [0.5, 0.75, 1, 1.5, 2, 3];
    const sensConv = [20, 30, 40, 50, 60, 75];
    const sensibiliteVolume = {
      titre: 'MRR au dernier mois projeté (€/mois)',
      lignes: sensDiag, colonnes: sensConv,
      labelLignes: 'Diagnostics / semaine', labelColonnes: 'Taux de conversion',
      fmtLigne: v => v.toString().replace('.', ',') + ' /sem',
      fmtColonne: v => v + ' %',
      valeurs: sensDiag.map(dg => sensConv.map(cv => mrrApres(nbMois, dg, cv, p.tauxRetentionAnnuel, p.prixAbonnementMensuel))),
    };

    const sensPrix = [95, 145, 185, 245, 320, 450];
    const sensRet = [60, 70, 80, 85, 92, 97];
    const sensibilitePrix = {
      titre: 'MRR au dernier mois projeté (€/mois)',
      lignes: sensPrix, colonnes: sensRet,
      labelLignes: 'Prix abonnement', labelColonnes: 'Rétention annuelle',
      fmtLigne: v => v + ' €',
      fmtColonne: v => v + ' %',
      valeurs: sensPrix.map(pr => sensRet.map(rt => mrrApres(nbMois, p.diagnosticsParSemaine, p.tauxConversion, rt, pr))),
    };

    /* ======================================================================
       3.9 — SCÉNARIOS
       ==================================================================== */
    function scenario(nom, mult) {
      const pp = Object.assign({}, p, mult);
      const ret = Math.min(0.999999, Math.max(0.0001, pp.tauxRetentionAnnuel / 100));
      const ch = 1 - Math.pow(ret, 1 / 12);
      const nAn = pp.diagnosticsParSemaine * (pp.joursTravaillesAn / 5) * (pp.tauxConversion / 100);
      const n = nAn / 12;
      let c = 0, caCum = 0, netCum = 0;
      for (let i = 0; i < nbMois; i++) {
        c = c * (1 - ch) + n;
        const ca = c * pp.prixAbonnementMensuel + n * pp.prixDeploiement;
        caCum += ca;
        netCum += ca * (pp.tauxNetIRConsultant / 100);
      }
      return {
        nom: nom,
        clientsFin: c,
        mrrFin: c * pp.prixAbonnementMensuel,
        caCumule: caCum,
        netCumule: netCum,
        netMensuelMoyen: netCum / nbMois,
        revenuMensuelMoyen: netCum / nbMois + salaireNetMois,
      };
    }

    const scenarios = [
      scenario('Pessimiste', { tauxConversion: Math.max(5, p.tauxConversion * 0.5), tauxRetentionAnnuel: Math.max(30, p.tauxRetentionAnnuel - 20), prixAbonnementMensuel: p.prixAbonnementMensuel * 0.8 }),
      scenario('Prudent', { tauxConversion: Math.max(5, p.tauxConversion * 0.75), tauxRetentionAnnuel: Math.max(40, p.tauxRetentionAnnuel - 10) }),
      scenario('Référence', {}),
      scenario('Optimiste', { tauxConversion: Math.min(100, p.tauxConversion * 1.2), diagnosticsParSemaine: p.diagnosticsParSemaine * 1.5, tauxRetentionAnnuel: Math.min(98, p.tauxRetentionAnnuel + 5) }),
      scenario('Agressif', { tauxConversion: Math.min(100, p.tauxConversion * 1.3), diagnosticsParSemaine: p.diagnosticsParSemaine * 2.5, prixAbonnementMensuel: p.prixAbonnementMensuel * 1.25, tauxRetentionAnnuel: Math.min(98, p.tauxRetentionAnnuel + 7) }),
    ];

    /* ======================================================================
       3.10 — COURBE DE RÉTENTION (cohorte)
       ==================================================================== */
    const cohorte = [];
    for (let m0 = 0; m0 <= 36; m0++) {
      cohorte.push({
        mois: m0,
        survie: Math.pow(survieMensuelle, m0),
        cumulRevenu: p.prixDeploiement + p.prixAbonnementMensuel *
          (churnMensuel > 0 ? survieMensuelle * (1 - Math.pow(survieMensuelle, m0)) / churnMensuel : m0),
      });
    }

    /* ==================================================================== */
    return {
      params: p,
      taux: { tauxConv, retention, netIRCons, churnMensuel, survieMensuelle },
      salaire, temps, unit, mois, annees, an1, an2, an3,
      jalons, plateau, synthese, sensibiliteVolume, sensibilitePrix, scenarios, cohorte,
      nouveauxParMois, nbMois,
    };
  }

  /* --------------------------------------------------------------------------
     4. FORMATAGE
     ------------------------------------------------------------------------ */
  const nfEuro0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const nfEuro2 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nfNum = (d) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

  const fmt = {
    euro: v => Number.isFinite(v) ? nfEuro0.format(v) : '—',
    euro2: v => Number.isFinite(v) ? nfEuro2.format(v) : '—',
    euroAuto: v => !Number.isFinite(v) ? '—' : (Math.abs(v) >= 1000 ? nfEuro0.format(v) : nfEuro2.format(v)),
    nb: (v, d) => Number.isFinite(v) ? nfNum(d === undefined ? 1 : d).format(v) : '—',
    pct: (v, d) => Number.isFinite(v) ? nfNum(d === undefined ? 1 : d).format(v * 100) + ' %' : '—',
    pctBrut: (v, d) => Number.isFinite(v) ? nfNum(d === undefined ? 1 : d).format(v) + ' %' : '—',
    heures: (v, d) => Number.isFinite(v) ? nfNum(d === undefined ? 1 : d).format(v) + ' h' : '—',
    jours: (v, d) => Number.isFinite(v) ? nfNum(d === undefined ? 1 : d).format(v) + ' j' : '—',
    compact: v => {
      if (!Number.isFinite(v)) return '—';
      const a = Math.abs(v);
      if (a >= 1e6) return nfNum(2).format(v / 1e6) + ' M';
      if (a >= 1e3) return nfNum(a >= 1e4 ? 0 : 1).format(v / 1e3) + ' k';
      return nfNum(0).format(v);
    },
    moisJalon: m => m ? m.labelLong + ' (M+' + (m.idx + 1) + ')' : 'jamais atteint sur l’horizon',
  };

  /* -------------------------------------------------------------------- */
  global.BP = { PARAM_GROUPS, PARAM_LIST, PARAM_BY_KEY, defaults, compute, fmt, parseMois, labelCourt, labelLong };

})(typeof window !== 'undefined' ? window : globalThis);
