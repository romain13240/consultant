/* ============================================================================
   app.js — Interface de l'étude : paramètres, tableaux, graphiques, UI
   ========================================================================== */
(function () {
  'use strict';

  const STORE_KEY = 'bp-consultant-ia-v2';
  const F = BP.fmt;
  const C = Charts.PALETTE;
  const COL = {
    dep: '#0071e3', mrr: '#00b8a9', net: '#34c759', sal: '#8e8e93',
    tot: '#5e5ce6', dep2: '#ff9f0a', risk: '#ff3b30', mkt: '#af52de', diag: '#ff2d55',
  };

  let params = charger();
  let R = null;

  /* ======================================================================
     PERSISTANCE
     ==================================================================== */
  function charger() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return BP.defaults();
      const saved = JSON.parse(raw);
      const base = BP.defaults();
      Object.keys(base).forEach(k => { if (saved[k] !== undefined && saved[k] !== null) base[k] = saved[k]; });
      return base;
    } catch (e) { return BP.defaults(); }
  }
  function sauver() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(params));
      flashSaved();
    } catch (e) { /* mode privé : on continue sans persistance */ }
  }
  let flashT = null;
  function flashSaved() {
    const b = document.getElementById('paramSaved');
    if (!b) return;
    b.textContent = 'Enregistré ✓';
    b.className = 'badge badge--ok';
    clearTimeout(flashT);
    flashT = setTimeout(() => { b.textContent = 'Sauvegardé'; b.className = 'badge badge--info'; }, 1600);
  }

  /* ======================================================================
     FORMULAIRE DE PARAMÈTRES
     ==================================================================== */
  function construireFormulaire() {
    const host = document.getElementById('paramForm');
    host.innerHTML = '';
    BP.PARAM_GROUPS.forEach(g => {
      const sec = document.createElement('div');
      sec.className = 'pgroup';
      sec.innerHTML = `<div class="pgroup__title"><h4>${g.icone} ${g.titre}</h4><span>${g.desc}</span></div><div class="pgrid"></div>`;
      const grid = sec.querySelector('.pgrid');
      g.params.forEach(p => grid.appendChild(champ(p)));
      host.appendChild(sec);
    });
    document.getElementById('paramCount').textContent = BP.PARAM_LIST.length;
  }

  function champ(p) {
    const d = document.createElement('div');
    d.className = 'field';
    d.dataset.key = p.key;
    if (p.type === 'month') {
      d.innerHTML = `
        <div class="field__top">
          <label class="field__label" for="f_${p.key}">${p.label}</label>
          <div class="field__input"><input type="month" id="f_${p.key}" value="${params[p.key]}"></div>
        </div>
        <div class="field__help">${p.help}</div>`;
      const inp = d.querySelector('input');
      inp.addEventListener('change', () => { params[p.key] = inp.value || p.def; appliquer(); });
      return d;
    }
    d.innerHTML = `
      <div class="field__top">
        <label class="field__label" for="f_${p.key}">${p.label}</label>
        <div class="field__input">
          <input type="number" id="f_${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${params[p.key]}">
          <span class="field__unit">${p.unit}</span>
        </div>
      </div>
      <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${params[p.key]}" aria-label="${p.label}">
      <div class="field__help">${p.help} <span class="field__def"></span></div>`;
    const num = d.querySelector('input[type=number]');
    const rng = d.querySelector('input[type=range]');
    function set(v, from) {
      let val = parseFloat(v);
      if (!Number.isFinite(val)) return;
      val = Math.min(p.max, Math.max(p.min, val));
      params[p.key] = val;
      if (from !== 'num') num.value = val;
      if (from !== 'rng') rng.value = val;
      majEtatChamp(d, p);
      appliquer();
    }
    num.addEventListener('input', () => set(num.value, 'num'));
    rng.addEventListener('input', () => set(rng.value, 'rng'));
    majEtatChamp(d, p);
    return d;
  }

  function majEtatChamp(d, p) {
    const modifie = params[p.key] !== p.def;
    d.classList.toggle('is-modified', modifie);
    const def = d.querySelector('.field__def');
    if (def) def.innerHTML = modifie ? `— défaut : <b>${p.def} ${p.unit}</b>` : '';
  }

  function rafraichirFormulaire() {
    BP.PARAM_LIST.forEach(p => {
      const d = document.querySelector(`.field[data-key="${p.key}"]`);
      if (!d) return;
      d.querySelectorAll('input').forEach(i => { i.value = params[p.key]; });
      majEtatChamp(d, p);
    });
  }

  function compterModifs() {
    return BP.PARAM_LIST.filter(p => params[p.key] !== p.def).length;
  }

  /* ======================================================================
     DICTIONNAIRE DES VALEURS AFFICHÉES
     ==================================================================== */
  function mrrFinalAvec(over) {
    return BP.compute(Object.assign({}, params, over)).synthese.mrrFinal;
  }
  function deltaPct(nouveau, base) {
    if (!base) return '—';
    const d = nouveau / base - 1;
    return (d >= 0 ? '+' : '') + F.pct(d, 0);
  }

  function dictionnaire() {
    const p = R.params, t = R.temps, u = R.unit, s = R.salaire, sy = R.synthese;
    const an1 = R.an1 || {}, an2 = R.an2 || {}, an3 = R.an3 || {};
    const mFin = R.mois[R.mois.length - 1];
    const mois1 = R.mois[0];
    const an1M = R.mois.filter(m => m.annee === an1.annee);
    const plateauEuroHeure = t.heuresTotalAn > 0 ? R.plateau.netAnnuel / t.heuresTotalAn : 0;
    const an1EuroHeureNet = an1.euroHeureNet || 0;

    // Leviers
    const mrrBase = sy.mrrFinal;
    const mrrP10 = mrrFinalAvec({ prixAbonnementMensuel: p.prixAbonnementMensuel + 10 });
    const mrrP25 = mrrFinalAvec({ prixAbonnementMensuel: p.prixAbonnementMensuel * 1.25 });
    const mrrDiag = mrrFinalAvec({ diagnosticsParSemaine: p.diagnosticsParSemaine + 1 });
    const retPlus = Math.min(99, p.tauxRetentionAnnuel + 7);
    const mrrRet = mrrFinalAvec({ tauxRetentionAnnuel: retPlus });
    const mrrConvMoitie = mrrFinalAvec({ tauxConversion: p.tauxConversion / 2 });
    const heuresDiagPlus = 1 * t.semainesTravailleesAn * p.heuresDiagnostic
      + 1 * t.semainesTravailleesAn * R.taux.tauxConv * t.heuresParAutomatisation;

    // Année où l'heure consultant dépasse l'heure salariée
    let anneeDep = null;
    R.annees.forEach(a => { if (anneeDep === null && a.euroHeureNet > s.euroHeurePresence) anneeDep = a.annee; });

    const V = {
      /* — en-tête / hero — */
      navMoisFin: mFin ? mFin.label : '—',
      navMrrFin: F.euro(sy.mrrFinal),
      navNetFin: F.euro(mFin ? mFin.revenuTotalNet : 0),
      horizonTexte: (mois1 ? mois1.label : '') + ' → ' + (mFin ? mFin.label : ''),
      moisDebutLong: mois1 ? mois1.labelLong : '—',
      moisFinLong: mFin ? mFin.labelLong : '—',
      heroMrrFin: F.euro(sy.mrrFinal),
      heroClientsFin: F.nb(sy.clientsFinal, 0),
      heroCaCumule: F.euro(sy.caCumule),
      heroJoursHebdo: F.nb(t.joursEquivalentsHebdo, 2),
      heroNetHeure: F.euro2(an2.euroHeureNet || an1EuroHeureNet),

      /* — paramètres bruts — */
      prixAbo: F.euro(p.prixAbonnementMensuel),
      prixAbo25: F.euro(p.prixAbonnementMensuel * 1.25),
      prixDeploiement: F.euro(p.prixDeploiement),
      joursDeploiement: F.jours(p.joursDeploiement, 2).replace(',00', ''),
      heuresDiag: F.heures(p.heuresDiagnostic, 2).replace(',00', ''),
      diagSem: F.nb(p.diagnosticsParSemaine, 2).replace(',00', '') + ' /semaine',
      tauxConversion: F.pctBrut(p.tauxConversion, 0),
      conv25: F.pctBrut(p.tauxConversion / 2, 0),
      pctNonConverti: F.pct(1 - R.taux.tauxConv, 0),
      tauxRetention: F.pctBrut(p.tauxRetentionAnnuel, 0),
      retentionPlus: F.pctBrut(retPlus, 0),
      churnMensuel: F.pct(R.taux.churnMensuel, 2),
      tauxNetIRCons: F.pctBrut(p.tauxNetIRConsultant, 0),
      tauxNetIRSalaire: F.pctBrut(p.tauxNetIRSalaire, 0),
      salaireNetMensuel: F.euro(p.salaireNetMensuelNG),
      salaireNetIRMensuel: F.euro(s.netMensuelIR),
      depensesMensuelles: F.euro(p.depensesMensuelles),
      joursAn: F.jours(p.joursTravaillesAn, 0),
      heuresJour: F.heures(p.heuresParJour, 1).replace(',0', ''),
      heuresDispoJour: F.heures(p.heuresDispoParJourAgentIA, 2).replace(',00', ''),
      nbMois: R.nbMois,
      nbParams: BP.PARAM_LIST.length,

      /* — entonnoir — */
      semainesAn: F.nb(t.semainesTravailleesAn, 1),
      diagnosticsAn: F.nb(t.diagnosticsAn, 1),
      clientsAn: F.nb(t.clientsAn, 1),
      autoSemaine: F.nb(t.automatisationsParSemaine, 2),
      nouveauxMois: F.nb(R.nouveauxParMois, 2),
      caDepAn: F.euro(t.clientsAn * p.prixDeploiement),
      mrrAjouteMois: F.euro(R.nouveauxParMois * p.prixAbonnementMensuel),

      /* — salariat — */
      ngJoursSem: F.jours(p.joursNGParSemaine, 1).replace(',0', '') + '/sem',
      ngHeuresJour: F.heures(p.heuresPresenceParJourNG, 1).replace(',0', ''),
      ngSemaines: F.nb(p.semainesNGParAn, 0),
      ngTeletravail: F.jours(p.joursTeletravailParSemaine, 1).replace(',0', ''),
      ngPresenceHebdo: F.heures(s.heuresPresenceHebdo, 1).replace(',0', ''),
      ngCerebralHebdo: F.heures(s.heuresCerebralHebdo, 1).replace(',0', ''),
      ngPresenceAn: F.heures(s.heuresPresenceAnnuel, 0),
      ngCerebralAn: F.heures(s.heuresCerebralAnnuel, 0),
      ngMargeCognitive: F.heures(s.margeCognitiveAnnuelle, 0),
      ngIntensite: F.pct(s.tauxIntensite, 0),
      ngJoursAn: F.jours(s.joursAnnuelTempsPartiel, 0),
      ngJoursSite: F.jours(s.joursSurSiteAnnuel, 0),
      ngHeuresReellesJour: F.heures(s.heuresTravailReelParJour, 2).replace(',00', ''),
      ngAnnuelAvantIR: F.euro(s.annuelAvantIR),
      ngAnnuelNetIR: F.euro(s.annuelNetIR),
      ngEuroHeure: F.euro2(s.euroHeurePresence),
      ngEuroHeureCerebral: F.euro2(s.euroHeureCerebral),

      /* — capacité consultant — */
      heuresDispoAn: F.heures(t.heuresDispoAn, 0),
      heuresTotalAn: F.heures(t.heuresTotalAn, 0),
      heuresHorsMarketing: F.heures(t.heuresHorsMarketingAn, 0),
      heuresHebdo: F.heures(t.heuresHebdo, 1),
      chargeHeuresJour: F.heures(t.chargeHeuresParJour, 2),
      joursEqHebdo: F.nb(t.joursEquivalentsHebdo, 2) + ' j',
      pctProspection: F.pct(t.pctProspection, 1),
      heuresEngageesHebdo: F.heures(t.heuresEngageesHebdo, 1),
      heuresEngageesAn: F.heures(t.heuresEngageesAn, 0),

      /* — unit economics — */
      caJourConsultant: F.euro2(u.caJourConsultant),
      caHeureConsultant: F.euro2(u.caHeureConsultant),
      netHeureConsultant: F.euro2(u.netHeureConsultant),
      heuresParAuto: F.heures(u.heuresParAutomatisation, 1).replace(',0', ''),
      heuresProspVente: F.heures(u.heuresProspectionParVente, 1),
      heuresParClient: F.heures(u.heuresTotalesParClient, 1),
      mrrAnnuelClient: F.euro(u.mrrAnnuelParClient),
      mrrAn1Churn: F.euro(u.mrrAn1AvecChurn),
      moisPayes: F.nb(u.moisPayesAn1, 1) + ' mois',
      revenuClientAn1: F.euro(u.revenuClientAn1),
      caHeureAn1: F.euro2(u.caHeureAn1ToutCompris),
      caHeureAn1HorsMkt: F.euro2(u.caHeureAn1HorsMarketing),
      netHeureAn1: F.euro2(u.netHeureAn1),
      dureeVie: F.nb(u.dureeVieMois, 1) + ' mois',
      ltvBrute: F.euro(u.ltvBrute),
      ltvNette: F.euro(u.ltvNette),
      ltvParHeure: F.euro2(u.heuresTotalesParClient > 0 ? u.ltvNette / u.heuresTotalesParClient : 0),

      /* — projection — */
      mrrFinal: F.euro(sy.mrrFinal),
      arrFinal: F.euro(sy.arrFinal),
      clientsFinal: F.nb(sy.clientsFinal, 1),
      clientsSignes: F.nb(mFin ? mFin.cumulClientsSignes : 0, 0),
      clientsPerdus: F.nb(mFin ? mFin.cumulClientsPerdus : 0, 1),
      caCumule: F.euro(sy.caCumule),
      netCumule: F.euro(sy.netCumule),
      epargneCumulee: F.euro(sy.epargneCumulee),

      /* — jalons — */
      jalonMrrDepasse: F.moisJalon(R.jalons.mrrEgaleDeploiement),
      jalonNetSalaire: F.moisJalon(R.jalons.netEgaleSalaire),
      jalonMrrDepenses: F.moisJalon(R.jalons.mrrNetCouvreDepenses),

      /* — plateau — */
      plateauClients: F.nb(R.plateau.clients, 0),
      plateauMrr: F.euro(R.plateau.mrr),
      plateauMrr2x: F.euro(R.plateau.mrr * 2),
      plateauArr: F.euro(R.plateau.mrr * 12),
      plateauCa: F.euro(R.plateau.caAnnuel),
      plateauNet: F.euro(R.plateau.netAnnuel),
      plateauDelai: F.nb(R.plateau.moisPourAtteindre90, 0) + ' mois',
      plateauEuroHeure: F.euro2(plateauEuroHeure),
      facteurProgression: an1EuroHeureNet > 0 ? '× ' + F.nb(plateauEuroHeure / an1EuroHeureNet, 1) : '—',
      anneeDepassement: anneeDep === null ? '—' : anneeDep,

      /* — leviers — */
      lev10Mrr: F.euro(mrrP10), lev10Delta: deltaPct(mrrP10, mrrBase),
      levDiagMrr: F.euro(mrrDiag), levDiagDelta: deltaPct(mrrDiag, mrrBase),
      levDiagHeures: F.heures(heuresDiagPlus, 0),
      levRetMrr: F.euro(mrrRet), levRetDelta: deltaPct(mrrRet, mrrBase),
      mrrConv25: F.euro(mrrConvMoitie),
      gainPrix25: F.euro(mrrP25 - mrrBase),
      seuilSupport: F.nb(0.10 * t.heuresTotalAn / 6, 0) + ' clients',
      ecartScenarios: R.scenarios[0].netCumule > 0
        ? '× ' + F.nb(R.scenarios[4].netCumule / R.scenarios[0].netCumule, 1) : '—',
    };

    /* — blocs annuels — */
    [['an1', an1], ['an2', an2], ['an3', an3]].forEach(([pref, a]) => {
      if (!a || a.annee === undefined) {
        ['Annee', 'Ca', 'CaDep', 'Mrr', 'Net', 'NetMensuel', 'RevenuTotal', 'Epargne', 'EpargneMens',
          'ClientsFin', 'MrrFin', 'PartMrr', 'EuroHeure', 'EuroHeure208', 'EuroJour208', 'NetMensuelTotal',
          'Depenses', 'MrrNet', 'NetMrrParHeure', 'NetMensuelCons'].forEach(k => { V[pref + k] = '—'; });
        return;
      }
      V[pref + 'Annee'] = a.annee;
      V[pref + 'Ca'] = F.euro(a.caTotal);
      V[pref + 'CaDep'] = F.euro(a.caDeploiement);
      V[pref + 'Mrr'] = F.euro(a.mrr);
      V[pref + 'MrrNet'] = F.euro(a.netIRMrr);
      V[pref + 'Net'] = F.euro(a.netIRConsultant);
      V[pref + 'NetMensuel'] = F.euro(a.netMensuelConsultant);
      V[pref + 'NetMensuelCons'] = F.euro(a.netMensuelConsultant);
      V[pref + 'NetMensuelTotal'] = F.euro(a.netMensuelTotal);
      V[pref + 'RevenuTotal'] = F.euro(a.revenuTotalNet);
      V[pref + 'Depenses'] = F.euro(a.depenses);
      V[pref + 'Epargne'] = F.euro(a.epargne);
      V[pref + 'EpargneMens'] = F.euro(a.epargneMensuelle);
      V[pref + 'ClientsFin'] = F.nb(a.clientsFin, 1);
      V[pref + 'MrrFin'] = F.euro(a.mrrFin);
      V[pref + 'PartMrr'] = F.pct(a.partMrrDansCa, 0);
      V[pref + 'EuroHeure'] = F.euro2(a.euroHeureNet);
      V[pref + 'EuroHeureNet'] = F.euro2(a.euroHeureNet);
      V[pref + 'EuroHeure208'] = F.euro2(a.euroHeure208);
      V[pref + 'EuroJour208'] = F.euro2(a.euroJour208);
      V[pref + 'NetMrrParHeure'] = F.euro2(t.heuresTotalAn > 0 ? a.netIRMrr / t.heuresTotalAn : 0);
    });

    V.revMensuelTotalAn1 = V.an1NetMensuelTotal;
    V.netMensuelConsAn1 = V.an1NetMensuel;
    V.epargneMensAn1 = V.an1EpargneMens;
    V.epargneAnAn1 = V.an1Epargne;
    V.an1RevMois1 = an1M.length ? F.euro(an1M[0].revenuTotalNet) : '—';
    V.an1RevMois12 = an1M.length ? F.euro(an1M[an1M.length - 1].revenuTotalNet) : '—';
    V.an1Progression = an1M.length > 1
      ? deltaPct(an1M[an1M.length - 1].revenuTotalNet, an1M[0].revenuTotalNet) : '—';
    V.an2VsAn1 = (an1.caTotal && an2.caTotal) ? deltaPct(an2.caTotal, an1.caTotal) : '—';

    return V;
  }

  function injecter(V) {
    document.querySelectorAll('[data-v]').forEach(n => {
      const k = n.getAttribute('data-v');
      n.textContent = (V[k] === undefined || V[k] === null) ? '—' : V[k];
    });
  }

  /* ======================================================================
     TABLEAUX
     ==================================================================== */
  function td(v, cls) { return `<td${cls ? ' class="' + cls + '"' : ''}>${v}</td>`; }

  function tableauMrr() {
    const tb = document.querySelector('#tblMrr tbody');
    const tf = document.querySelector('#tblMrr tfoot');
    let html = '';
    let anneePrec = null;
    R.mois.forEach(m => {
      const start = anneePrec !== null && m.annee !== anneePrec;
      anneePrec = m.annee;
      html += `<tr${start ? ' class="yr-start"' : ''}>`
        + td('<b>' + m.label + '</b>', 'k')
        + td(F.nb(m.nouveauxClients, 2))
        + td(F.nb(m.clientsPerdus, 2))
        + td(F.nb(m.clientsActifs, 1), 'k')
        + td(F.euro(m.caDeploiement))
        + td(F.euro(m.mrr), 'hl')
        + td(F.euro(m.caTotal), 'k')
        + td(F.euro(m.netIRMrr))
        + td(F.euro(m.netIRDeploiement))
        + td(F.euro(m.netIRConsultant), 'k')
        + td(F.euro(m.salaireNet))
        + td(F.euro(m.revenuTotalNet), 'hl')
        + td(F.euro(m.epargne), m.epargne >= 0 ? 'pos' : 'neg')
        + td(F.nb(m.heuresHebdo, 1))
        + td(F.nb(m.joursEquivalentsHebdo, 2))
        + '</tr>';
    });
    tb.innerHTML = html;

    const S = R.mois.reduce((a, m) => {
      a.nouv += m.nouveauxClients; a.perdus += m.clientsPerdus;
      a.dep += m.caDeploiement; a.mrr += m.mrr; a.ca += m.caTotal;
      a.nmrr += m.netIRMrr; a.ndep += m.netIRDeploiement; a.net += m.netIRConsultant;
      a.sal += m.salaireNet; a.rev += m.revenuTotalNet; a.ep += m.epargne;
      return a;
    }, { nouv: 0, perdus: 0, dep: 0, mrr: 0, ca: 0, nmrr: 0, ndep: 0, net: 0, sal: 0, rev: 0, ep: 0 });
    const last = R.mois[R.mois.length - 1];
    tf.innerHTML = '<tr>' + td('<b>Total ' + R.nbMois + ' mois</b>')
      + td(F.nb(S.nouv, 1)) + td(F.nb(S.perdus, 1)) + td(F.nb(last.clientsActifs, 1))
      + td(F.euro(S.dep)) + td(F.euro(S.mrr)) + td(F.euro(S.ca))
      + td(F.euro(S.nmrr)) + td(F.euro(S.ndep)) + td(F.euro(S.net))
      + td(F.euro(S.sal)) + td(F.euro(S.rev)) + td(F.euro(S.ep))
      + td('—') + td('—') + '</tr>';
  }

  function tableauAnnuel() {
    const tb = document.querySelector('#tblAnnuel tbody');
    tb.innerHTML = R.annees.map(a => '<tr>'
      + td('<b>' + a.annee + '</b>' + (a.complete ? '' : ' <span class="badge">partiel</span>'), 'k')
      + td(a.nbMois)
      + td(F.euro(a.caDeploiement))
      + td(F.euro(a.mrr))
      + td(F.euro(a.caTotal), 'k')
      + td(F.pct(a.partMrrDansCa, 0), 'hl')
      + td(F.euro(a.netIRConsultant), 'k')
      + td(F.euro(a.salaireNet))
      + td(F.euro(a.revenuTotalNet), 'hl')
      + td(F.euro(a.depenses))
      + td(F.euro(a.epargne), a.epargne >= 0 ? 'pos' : 'neg')
      + td(F.nb(a.clientsFin, 1))
      + td(F.euro(a.mrrFin))
      + td(F.nb(a.heuresTravaillees, 0))
      + td(F.euro2(a.euroHeureNet))
      + td(F.euro2(a.euroJour208))
      + '</tr>').join('');
  }

  function tableauJalons() {
    const J = [
      ['Le MRR dépasse le CA de déploiement', 'MRR ≥ CA déploiement mensuel', R.jalons.mrrEgaleDeploiement],
      ['Le net consultant couvre les dépenses', 'net consultant ≥ ' + F.euro(R.params.depensesMensuelles), R.jalons.netCouvreDepenses],
      ['MRR à 1 000 €/mois', 'MRR ≥ 1 000 €', R.jalons.mrr1k],
      ['Le net consultant égale le salaire net IR', 'net consultant ≥ ' + F.euro(R.salaire.netMensuelIR), R.jalons.netEgaleSalaire],
      ['MRR à 5 000 €/mois', 'MRR ≥ 5 000 €', R.jalons.mrr5k],
      ['Le MRR net seul couvre les dépenses', 'net MRR ≥ ' + F.euro(R.params.depensesMensuelles), R.jalons.mrrNetCouvreDepenses],
      ['Le revenu total double le salaire', 'revenu total ≥ ' + F.euro(2 * R.salaire.netMensuelIR), R.jalons.revenuDouble],
      ['MRR à 10 000 €/mois', 'MRR ≥ 10 000 €', R.jalons.mrr10k],
    ].filter(j => j[2]).sort((a, b) => a[2].idx - b[2].idx);
    const nonAtteints = [
      ['MRR à 5 000 €/mois', 'MRR ≥ 5 000 €', R.jalons.mrr5k],
      ['MRR à 10 000 €/mois', 'MRR ≥ 10 000 €', R.jalons.mrr10k],
      ['Le revenu total double le salaire', 'revenu total ≥ ' + F.euro(2 * R.salaire.netMensuelIR), R.jalons.revenuDouble],
      ['Le MRR net seul couvre les dépenses', 'net MRR ≥ ' + F.euro(R.params.depensesMensuelles), R.jalons.mrrNetCouvreDepenses],
    ].filter(j => !j[2]);

    let html = J.map(j => '<tr>'
      + td('<b>' + j[0] + '</b>', 'k') + td('<span class="mono">' + j[1] + '</span>')
      + td('<span class="badge badge--ok">' + j[2].labelLong + '</span>')
      + td('M+' + (j[2].idx + 1))
      + td(F.euro(j[2].mrr)) + td(F.euro(j[2].revenuTotalNet), 'hl') + '</tr>').join('');
    html += nonAtteints.map(j => '<tr>'
      + td('<b>' + j[0] + '</b>', 'k') + td('<span class="mono">' + j[1] + '</span>')
      + td('<span class="badge badge--warn">hors horizon</span>') + td('—') + td('—') + td('—') + '</tr>').join('');
    document.querySelector('#tblJalons tbody').innerHTML = html;
  }

  function tableauScenarios() {
    const hyp = [
      'conversion ÷ 2, rétention −20 pts, prix −20 %',
      'conversion × 0,75, rétention −10 pts',
      'vos paramètres actuels',
      'conversion × 1,2, diagnostics × 1,5, rétention +5 pts',
      'conversion × 1,3, diagnostics × 2,5, prix × 1,25, rétention +7 pts',
    ];
    document.querySelector('#tblScenarios tbody').innerHTML = R.scenarios.map((s, i) => {
      const ref = i === 2;
      return `<tr${ref ? ' class="is-total"' : ''}>`
        + td('<b>' + s.nom + '</b>' + (ref ? ' <span class="badge badge--info">référence</span>' : ''), 'k')
        + td('<span style="font-size:12.5px;color:var(--muted)">' + hyp[i] + '</span>')
        + td(F.nb(s.clientsFin, 1))
        + td(F.euro(s.mrrFin), 'hl')
        + td(F.euro(s.caCumule))
        + td(F.euro(s.netCumule))
        + td(F.euro(s.netMensuelMoyen))
        + td(F.euro(s.revenuMensuelMoyen), 'k')
        + '</tr>';
    }).join('');
  }

  function tableauParams() {
    document.querySelector('#tblParams tbody').innerHTML = BP.PARAM_LIST.map(p => {
      const g = BP.PARAM_GROUPS.find(x => x.id === p.groupe);
      const mod = params[p.key] !== p.def;
      return '<tr>'
        + td('<span style="color:var(--muted)">' + g.icone + ' ' + g.titre + '</span>')
        + td('<b>' + p.label + '</b>', 'k')
        + td('<b>' + params[p.key] + '</b>', mod ? 'hl' : '')
        + td(p.def)
        + td(p.unit || '—')
        + td(mod ? '<span class="badge badge--warn">modifié</span>' : '<span class="badge">défaut</span>')
        + '</tr>';
    }).join('');
  }

  function listeIndicateurs() {
    const V = dictionnaire();
    const L = [
      ['Salariat', "Salaire annuel net d'IR", V.ngAnnuelNetIR],
      ['Salariat', 'Heures hebdomadaires de temps de présence', V.ngPresenceHebdo],
      ['Salariat', 'Heures hebdomadaires de travail cérébral', V.ngCerebralHebdo],
      ['Salariat', 'Heures annuelles de présence', V.ngPresenceAn],
      ['Salariat', 'Heures annuelles de travail cérébral', V.ngCerebralAn],
      ['Salariat', 'Jours annuels travaillés à temps partiel', V.ngJoursAn],
      ['Salariat', 'Jours sur site par an (hors télétravail)', V.ngJoursSite],
      ['Salariat', 'Heures de travail réel par jour de présence', V.ngHeuresReellesJour],
      ['Salariat', 'Heures de travail réel annuelles', V.ngCerebralAn],
      ['Salariat', 'Net IR par heure de présence', V.ngEuroHeure],
      ['Salariat', 'Net IR par heure de travail réel', V.ngEuroHeureCerebral],

      ['Capacité', 'Jours travaillés par an', V.joursAn],
      ['Capacité', 'Semaines travaillées par an (5 j/sem)', V.semainesAn],
      ['Capacité', 'Heures disponibles de travail sur l’année', V.heuresDispoAn],
      ['Capacité', 'Heures disponibles pour travail réel par jour', V.chargeHeuresJour],
      ['Capacité', "Heures annuelles à consacrer à l'agent IA", V.heuresTotalAn],
      ['Capacité', 'Heures hebdomadaires sur le business', V.heuresHebdo],
      ['Capacité', 'Jours équivalents travaillés par semaine', V.joursEqHebdo],
      ['Capacité', 'Part du temps à prospecter plutôt qu’implémenter', V.pctProspection],
      ['Capacité', 'Heures réellement travaillées hors marketing', V.heuresHorsMarketing],
      ['Capacité', 'Charge combinée salariat + business, par semaine', V.heuresEngageesHebdo],

      ['Unit economics', 'Euros facturés par jour en tant que consultant', V.caJourConsultant],
      ['Unit economics', 'Euros par heure facturée en tant que consultant', V.caHeureConsultant],
      ['Unit economics', 'Part du CA qui reste net d’impôt', V.tauxNetIRCons],
      ['Unit economics', 'Euros/h net IR travaillés en tant que consultant IA', V.netHeureConsultant],
      ['Unit economics', 'Euros par automatisation de base', V.prixDeploiement],
      ['Unit economics', 'Heures travaillées par automatisation de base', V.heuresParAuto],
      ['Unit economics', 'Euros de MRR mensuel par automatisation', V.prixAbo],
      ['Unit economics', 'Euros de MRR par client', V.prixAbo],
      ['Unit economics', 'Euros de MRR annuel par client', V.mrrAnnuelClient],
      ['Unit economics', 'Euros de revenu par client la première année', V.revenuClientAn1],
      ['Unit economics', 'Euros/h facturés au client la première année', V.caHeureAn1],
      ['Unit economics', 'Euros/h net IR la première année', V.netHeureAn1],
      ['Unit economics', 'Taux de rétention annuel', V.tauxRetention],
      ['Unit economics', 'Churn mensuel équivalent', V.churnMensuel],
      ['Unit economics', 'Durée de vie moyenne d’un abonnement', V.dureeVie],
      ['Unit economics', 'LTV brute par client', V.ltvBrute],
      ['Unit economics', 'LTV nette d’impôt par client', V.ltvNette],
      ['Unit economics', 'Heures totales investies par client', V.heuresParClient],

      ['Commercial', 'Diagnostics gratuits par an', V.diagnosticsAn],
      ['Commercial', 'Automatisations vendues par semaine', V.autoSemaine],
      ['Commercial', 'Automatisations vendues par an', V.clientsAn],
      ['Commercial', 'Nouveaux clients par mois', V.nouveauxMois],
      ['Commercial', 'CA de déploiement annuel', V.caDepAn],

      ['Année 1', 'CA annuel', V.an1Ca],
      ['Année 1', 'Net IR annuel en tant que consultant', V.an1Net],
      ['Année 1', 'Net IR mensuel en tant que consultant', V.an1NetMensuel],
      ['Année 1', 'Euros de salaire mensuel consultant + CDI', V.an1NetMensuelTotal],
      ['Année 1', 'Revenus annuels totaux consultant + Naval Group', V.an1RevenuTotal],
      ['Année 1', 'Euros/h pour la base de jours travaillés', V.an1EuroHeure208],
      ['Année 1', 'Euros/jour pour la base de jours travaillés', V.an1EuroJour208],
      ['Année 1', 'Euros de liquidités (épargne) annuelles', V.an1Epargne],
      ['Année 1', 'Euros de liquidités supplémentaires mensuelles', V.an1EpargneMens],
      ['Année 1', 'Clients actifs en fin d’exercice', V.an1ClientsFin],

      ['Année 2', 'Nombre de clients la deuxième année', V.an2ClientsFin],
      ['Année 2', 'MRR généré la deuxième année', V.an2Mrr],
      ['Année 2', 'MRR net d’IR la deuxième année', V.an2MrrNet],
      ['Année 2', 'Euros nets de MRR par heure travaillée sur agent IA', V.an2NetMrrParHeure],
      ['Année 2', 'Euros mensuels nets IR déploiement + MRR', V.an2NetMensuelCons],
      ['Année 2', 'Euros mensuels nets consultant + Naval Group', V.an2NetMensuelTotal],
      ['Année 2', 'Euros de liquidités disponibles par mois après dépenses', V.an2EpargneMens],
      ['Année 2', 'Euros de liquidités ajoutées par an', V.an2Epargne],
      ['Année 2', 'Euros/h équivalent agent IA', V.an2EuroHeure],
      ['Année 2', 'CA annuel', V.an2Ca],

      ['Année 3', 'CA annuel', V.an3Ca],
      ['Année 3', 'Net consultant annuel', V.an3Net],
      ['Année 3', 'Revenu total net annuel', V.an3RevenuTotal],
      ['Année 3', 'Épargne annuelle', V.an3Epargne],
      ['Année 3', 'Euros/h équivalent agent IA', V.an3EuroHeure],

      ['Horizon complet', 'MRR au dernier mois', V.mrrFinal],
      ['Horizon complet', 'ARR au dernier mois', V.arrFinal],
      ['Horizon complet', 'Clients actifs au dernier mois', V.clientsFinal],
      ['Horizon complet', 'CA cumulé', V.caCumule],
      ['Horizon complet', 'Net consultant cumulé', V.netCumule],
      ['Horizon complet', 'Épargne cumulée', V.epargneCumulee],

      ['Régime permanent', 'Clients au plateau', V.plateauClients],
      ['Régime permanent', 'MRR au plateau', V.plateauMrr],
      ['Régime permanent', 'CA annuel au plateau', V.plateauCa],
      ['Régime permanent', 'Net IR annuel au plateau', V.plateauNet],
      ['Régime permanent', 'Euros/h net au plateau', V.plateauEuroHeure],
    ];
    return L;
  }

  function tableauIndicateurs() {
    document.querySelector('#tblIndicateurs tbody').innerHTML = listeIndicateurs()
      .map(l => '<tr>' + td('<span style="color:var(--muted)">' + l[0] + '</span>')
        + td('<b>' + l[1] + '</b>', 'k') + td(l[2], 'hl') + '</tr>').join('');
  }

  /* ======================================================================
     GRAPHIQUES
     ==================================================================== */
  function graphiques() {
    Charts.clearRegistry();
    const M = R.mois;
    const lab = M.map(m => m.label);
    const tips = M.map(m => m.labelLong);
    const eur = v => F.compact(v) + ' €';
    const reg = (id, fn) => { const h = document.getElementById(id); if (h) Charts.register(h, () => fn(h)); };

    /* -- 01 modèle : deux moteurs -- */
    reg('ch-moteurs', h => Charts.line(h, {
      labels: lab, tipTitles: tips, height: 236, fmtY: eur, fmtTip: F.euro,
      series: [
        { name: 'CA déploiement (linéaire)', values: M.map(m => m.caDeploiement), color: COL.dep, dash: '6 5' },
        { name: 'MRR (cumulatif)', values: M.map(m => m.mrr), color: COL.mrr, area: true },
      ],
    }));

    /* -- 03 capacité -- */
    reg('ch-ng', h => Charts.barsH(h, {
      rowH: 52, fmt: v => F.nb(v, 0) + ' h',
      items: [
        { name: 'Présence annuelle', value: R.salaire.heuresPresenceAnnuel, color: '#c7c7cc' },
        { name: 'Travail cérébral', value: R.salaire.heuresCerebralAnnuel, color: COL.sal },
        { name: 'Marge cognitive', value: R.salaire.margeCognitiveAnnuelle, color: COL.dep },
        { name: 'Business consultant', value: R.temps.heuresTotalAn, color: COL.mrr },
      ],
    }));

    reg('ch-charge', h => Charts.gauge(h, {
      value: R.temps.tauxCharge, max: 1.6, repere: 1, height: 216,
      label: F.pct(R.temps.tauxCharge, 0),
      sub: F.nb(R.temps.heuresTotalAn, 0) + ' h requises / ' + F.nb(R.temps.heuresCapaciteAgentIA, 0) + ' h disponibles',
      color: R.temps.tauxCharge > 1.05 ? '#ff3b30' : R.temps.tauxCharge > 0.9 ? '#ff9f0a' : '#34c759',
    }));

    const noteCharge = document.getElementById('chargeNote');
    if (noteCharge) {
      const tc = R.temps.tauxCharge;
      noteCharge.className = 'note ' + (tc > 1.05 ? 'note--risk' : tc > 0.9 ? 'note--warn' : 'note--ok');
      noteCharge.innerHTML = tc > 1.05
        ? `<b>Capacité dépassée de ${F.pct(tc - 1, 0)}.</b> Le modèle réclame ${F.nb(R.temps.heuresTotalAn, 0)} h par an pour ${F.nb(R.temps.heuresCapaciteAgentIA, 0)} h disponibles. Réduisez les diagnostics ou le marketing, ou augmentez la capacité quotidienne.`
        : tc > 0.9
          ? `<b>Capacité saturée à ${F.pct(tc, 0)}.</b> Aucune marge pour le support, les imprévus ou la montée en compétence. Toute hausse du volume commercial exigera une heure de plus par jour.`
          : `<b>Marge disponible : ${F.nb(R.temps.heuresCapaciteAgentIA - R.temps.heuresTotalAn, 0)} h par an.</b> Il reste de la place pour absorber le support client et augmenter le volume de diagnostics.`;
    }

    reg('ch-temps', h => Charts.donut(h, {
      height: 292, fmt: v => F.nb(v, 0) + ' h',
      centre: { haut: F.nb(R.temps.heuresTotalAn, 0) + ' h', bas: 'par an' },
      items: [
        { name: 'Déploiements', value: R.temps.heuresDeploiementAn, color: COL.dep },
        { name: 'Marketing / prospection', value: R.temps.heuresMarketingAn, color: COL.mkt },
        { name: 'Diagnostics gratuits', value: R.temps.heuresDiagAn, color: COL.diag },
      ],
    }));

    reg('ch-budget', h => Charts.barsH(h, {
      rowH: 50, fmt: v => F.nb(v, 1) + ' h/sem',
      items: [
        { name: 'Présence salariée', value: R.salaire.heuresPresenceHebdo, color: COL.sal },
        { name: 'Business consultant', value: R.temps.heuresHebdo, color: COL.mrr },
        { name: 'Total engagé', value: R.temps.heuresEngageesHebdo, color: COL.tot },
      ],
    }));

    /* -- 04 unit economics -- */
    reg('ch-ltv', h => Charts.line(h, {
      labels: R.cohorte.map(c => 'M' + c.mois), height: 300, fmtY: eur, fmtTip: F.euro,
      xEvery: 6, tipTitles: R.cohorte.map(c => 'Mois ' + c.mois + ' après signature'),
      series: [{ name: 'Revenu cumulé par client', values: R.cohorte.map(c => c.cumulRevenu), color: COL.mrr, area: true }],
    }));

    reg('ch-survie', h => Charts.line(h, {
      labels: R.cohorte.map(c => 'M' + c.mois), height: 200, xEvery: 6, legend: false,
      fmtY: v => Math.round(v * 100) + ' %', fmtTip: v => F.pct(v, 1), padLeft: 48,
      tipTitles: R.cohorte.map(c => 'Mois ' + c.mois),
      series: [{ name: 'Probabilité de survie', values: R.cohorte.map(c => c.survie), color: COL.mkt, area: true }],
    }));

    /* -- 05 MRR -- */
    const markers = [];
    if (R.jalons.mrrEgaleDeploiement) markers.push({ i: R.jalons.mrrEgaleDeploiement.idx, label: 'MRR > déploiement', color: '#ff9f0a' });
    if (R.jalons.netEgaleSalaire) markers.push({ i: R.jalons.netEgaleSalaire.idx, label: 'net = salaire', color: '#34c759' });
    reg('ch-mrr', h => Charts.line(h, {
      labels: lab, tipTitles: tips, height: 320, fmtY: eur, fmtTip: F.euro, markers: markers,
      series: [
        { name: 'MRR mensuel', values: M.map(m => m.mrr), color: COL.mrr, area: true },
        { name: 'MRR net d’impôt', values: M.map(m => m.netIRMrr), color: COL.net, dash: '5 4' },
      ],
    }));

    reg('ch-clients', h => Charts.line(h, {
      labels: lab, tipTitles: tips, height: 320, fmtY: v => F.nb(v, 0), fmtTip: v => F.nb(v, 2), padLeft: 46,
      series: [
        { name: 'Clients actifs', values: M.map(m => m.clientsActifs), color: COL.dep, area: true },
        { name: 'Cumul signés', values: M.map(m => m.cumulClientsSignes), color: COL.tot, dash: '5 4' },
        { name: 'Cumul perdus', values: M.map(m => m.cumulClientsPerdus), color: COL.risk, dash: '3 4' },
      ],
    }));

    /* -- 06 revenus -- */
    reg('ch-ca', h => Charts.bars(h, {
      labels: lab, tipTitles: tips, height: 320, fmtY: eur, fmtTip: F.euro, stacked: true,
      series: [
        { name: 'CA déploiement', values: M.map(m => m.caDeploiement), color: COL.dep },
        { name: 'MRR', values: M.map(m => m.mrr), color: COL.mrr },
      ],
    }));

    reg('ch-revenus', h => Charts.line(h, {
      labels: lab, tipTitles: tips, height: 320, fmtY: eur, fmtTip: F.euro,
      series: [
        { name: 'Revenu total net', values: M.map(m => m.revenuTotalNet), color: COL.tot, area: true },
        { name: 'Net consultant', values: M.map(m => m.netIRConsultant), color: COL.mrr },
        { name: 'Salaire net IR', values: M.map(m => m.salaireNet), color: COL.sal, dash: '5 4', lastDot: false },
        { name: 'Dépenses', values: M.map(m => m.depenses), color: COL.risk, dash: '3 4', lastDot: false },
      ],
    }));

    reg('ch-treso', h => Charts.line(h, {
      labels: lab, tipTitles: tips, height: 300, fmtY: eur, fmtTip: F.euro,
      series: [
        { name: 'Épargne cumulée', values: M.map(m => m.cumulEpargne), color: COL.net, area: true },
        { name: 'Net consultant cumulé', values: M.map(m => m.cumulNetConsultant), color: COL.mrr, dash: '5 4' },
      ],
    }));

    reg('ch-partmrr', h => Charts.line(h, {
      labels: lab, tipTitles: tips, height: 300, padLeft: 52,
      fmtY: v => Math.round(v * 100) + ' %', fmtTip: v => F.pct(v, 1),
      series: [{ name: 'Part du MRR dans le CA', values: M.map(m => m.caTotal > 0 ? m.mrr / m.caTotal : 0), color: COL.mkt, area: true }],
    }));

    /* -- 07 annuel -- */
    const A = R.annees;
    reg('ch-annuelCa', h => Charts.bars(h, {
      labels: A.map(a => String(a.annee)), height: 300, fmtY: eur, fmtTip: F.euro, stacked: true,
      series: [
        { name: 'CA déploiement', values: A.map(a => a.caDeploiement), color: COL.dep },
        { name: 'CA abonnements', values: A.map(a => a.mrr), color: COL.mrr },
      ],
    }));
    reg('ch-annuelRev', h => Charts.bars(h, {
      labels: A.map(a => String(a.annee)), height: 300, fmtY: eur, fmtTip: F.euro, stacked: true,
      series: [
        { name: 'Salaire net IR', values: A.map(a => a.salaireNet), color: COL.sal },
        { name: 'Net consultant', values: A.map(a => a.netIRConsultant), color: COL.mrr },
        { name: 'Épargne dégagée', values: A.map(a => a.epargne), color: COL.net },
      ],
    }));

    const a2 = R.an2 || R.an1;
    if (a2) {
      reg('ch-waterfall', h => Charts.waterfall(h, {
        height: 330, fmt: F.compact,
        items: [
          { name: 'CA total', sous: F.euro(a2.caTotal), value: a2.caTotal, type: 'start', color: COL.dep },
          { name: 'Charges', sous: F.pctBrut(100 - R.params.tauxNetIRConsultant, 0), value: -(a2.caTotal - a2.netIRConsultant), type: 'delta', color: COL.risk },
          { name: 'Salaire net', sous: 'Naval Group', value: a2.salaireNet, type: 'delta', color: COL.sal },
          { name: 'Dépenses', sous: F.euro(R.params.depensesMensuelles) + '/mois', value: -a2.depenses, type: 'delta', color: COL.dep2 },
          { name: 'Épargne', sous: 'nette annuelle', value: a2.epargne, type: 'total', color: COL.net },
        ],
      }));
    }

    /* -- 08 année 1 -- */
    const M1 = R.an1 ? M.filter(m => m.annee === R.an1.annee) : [];
    if (M1.length) {
      reg('ch-an1', h => Charts.line(h, {
        labels: M1.map(m => m.label), tipTitles: M1.map(m => m.labelLong), height: 300,
        fmtY: eur, fmtTip: F.euro, xEvery: 1,
        series: [
          { name: 'MRR', values: M1.map(m => m.mrr), color: COL.mrr, area: true },
          { name: 'CA total', values: M1.map(m => m.caTotal), color: COL.dep },
          { name: 'Net consultant', values: M1.map(m => m.netIRConsultant), color: COL.net, dash: '5 4' },
        ],
      }));
    }

    /* -- 09 année 2 -- */
    if (R.an1 && R.an2) {
      reg('ch-an1an2', h => Charts.bars(h, {
        labels: ['CA déploi.', 'CA MRR', 'CA total', 'Net consult.', 'Revenu total', 'Épargne'],
        height: 300, fmtY: eur, fmtTip: F.euro, stacked: false,
        series: [
          { name: 'Année ' + R.an1.annee, values: [R.an1.caDeploiement, R.an1.mrr, R.an1.caTotal, R.an1.netIRConsultant, R.an1.revenuTotalNet, R.an1.epargne], color: '#c7c7cc' },
          { name: 'Année ' + R.an2.annee, values: [R.an2.caDeploiement, R.an2.mrr, R.an2.caTotal, R.an2.netIRConsultant, R.an2.revenuTotalNet, R.an2.epargne], color: COL.dep },
        ],
      }));
      const M2 = M.filter(m => m.annee === R.an2.annee);
      reg('ch-an2', h => Charts.line(h, {
        labels: M2.map(m => m.label), tipTitles: M2.map(m => m.labelLong), height: 300,
        fmtY: eur, fmtTip: F.euro, xEvery: 1,
        series: [
          { name: 'Revenu total net', values: M2.map(m => m.revenuTotalNet), color: COL.tot, area: true },
          { name: 'Net consultant', values: M2.map(m => m.netIRConsultant), color: COL.mrr },
          { name: 'Salaire net IR', values: M2.map(m => m.salaireNet), color: COL.sal, dash: '5 4', lastDot: false },
        ],
      }));
    }

    /* -- 10 plateau -- */
    reg('ch-plateau', h => Charts.line(h, {
      labels: lab, tipTitles: tips, height: 300, fmtY: v => F.nb(v, 0), fmtTip: v => F.nb(v, 1), padLeft: 46,
      series: [
        { name: 'Clients actifs projetés', values: M.map(m => m.clientsActifs), color: COL.dep, area: true },
        { name: 'Plateau théorique', values: M.map(() => Math.min(R.plateau.clients, 1e6)), color: COL.mkt, dash: '6 5', lastDot: false },
      ],
    }));

    /* -- 11 comparatif €/h -- */
    reg('ch-euroheure', h => Charts.barsH(h, {
      rowH: 46, fmt: F.euro2,
      items: [
        { name: 'Salariat (présence)', value: R.salaire.euroHeurePresence, color: '#c7c7cc' },
        { name: 'Salariat (travail réel)', value: R.salaire.euroHeureCerebral, color: COL.sal },
        { name: 'Implémentation facturée', value: R.unit.netHeureConsultant, color: COL.dep },
        { name: 'Consultant — année ' + (R.an1 ? R.an1.annee : 1), value: R.an1 ? R.an1.euroHeureNet : 0, color: '#7ab8f5' },
        { name: 'Consultant — année ' + (R.an2 ? R.an2.annee : 2), value: R.an2 ? R.an2.euroHeureNet : 0, color: COL.mrr },
        { name: 'Consultant — année ' + (R.an3 ? R.an3.annee : 3), value: R.an3 ? R.an3.euroHeureNet : 0, color: COL.net },
        { name: 'Au plateau', value: R.temps.heuresTotalAn > 0 ? R.plateau.netAnnuel / R.temps.heuresTotalAn : 0, color: COL.tot },
      ],
    }));

    /* -- 13 sensibilité -- */
    reg('ch-sens1', h => Charts.heatmap(h, Object.assign({}, R.sensibiliteVolume, { fmt: F.compact, cellH: 48 })));
    reg('ch-sens2', h => Charts.heatmap(h, Object.assign({}, R.sensibilitePrix, { fmt: F.compact, cellH: 48 })));

    /* -- 14 scénarios -- */
    reg('ch-scenarios', h => Charts.bars(h, {
      labels: R.scenarios.map(s => s.nom), height: 300, fmtY: eur, fmtTip: F.euro, stacked: false,
      series: [
        { name: 'MRR final', values: R.scenarios.map(s => s.mrrFin), color: COL.mrr },
        { name: 'Net moyen / mois', values: R.scenarios.map(s => s.netMensuelMoyen), color: COL.dep },
        { name: 'Revenu total / mois', values: R.scenarios.map(s => s.revenuMensuelMoyen), color: COL.tot },
      ],
    }));
  }

  /* ======================================================================
     EXPORTS
     ==================================================================== */
  // Deux contextes d'execution : navigateur classique (fichier local, Raspberry Pi)
  // ou le lien blob fonctionne, et visualiseur d'Artifact ou il est inerte --
  // il faut alors passer par la capacite « downloads ».
  let _dl;   // undefined = non resolu, null = indisponible
  function capaciteTelechargement() {
    if (_dl !== undefined) return Promise.resolve(_dl);
    if (!(window.claude && typeof window.claude.use === 'function')) {
      _dl = null;
      return Promise.resolve(null);
    }
    return Promise.resolve(window.claude.use('downloads'))
      .then(ns => (_dl = ns || null))
      .catch(() => (_dl = null));
  }

  function telechargerNavigateur(nom, contenu, type) {
    const blob = new Blob([contenu], { type: type || 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  function telecharger(nom, contenu, type) {
    const donnees = '﻿' + contenu;   // BOM : Excel ouvre le CSV en UTF-8
    capaciteTelechargement().then(dl => {
      if (!dl) return telechargerNavigateur(nom, donnees, type);
      return dl.save({ filename: nom, data: donnees }).catch(err => {
        const code = err && err.code;
        if (code === 'declined' || code === 'rate_limited') return;
        telechargerNavigateur(nom, donnees, type);
      });
    });
  }
  const csvNb = v => String(Math.round(v * 100) / 100).replace('.', ',');

  function csvMrr() {
    const head = ['Mois', 'Nouveaux clients', 'Clients perdus', 'Clients actifs', 'CA deploiement', 'MRR',
      'CA total', 'Net MRR', 'Net deploiement', 'Net consultant', 'Salaire net IR', 'Revenu total net',
      'Epargne', 'Heures/semaine', 'Jours equivalents/semaine'];
    const rows = R.mois.map(m => [m.label, csvNb(m.nouveauxClients), csvNb(m.clientsPerdus), csvNb(m.clientsActifs),
      csvNb(m.caDeploiement), csvNb(m.mrr), csvNb(m.caTotal), csvNb(m.netIRMrr), csvNb(m.netIRDeploiement),
      csvNb(m.netIRConsultant), csvNb(m.salaireNet), csvNb(m.revenuTotalNet), csvNb(m.epargne),
      csvNb(m.heuresHebdo), csvNb(m.joursEquivalentsHebdo)].join(';'));
    telecharger('mrr-mensuel.csv', [head.join(';')].concat(rows).join('\r\n'));
  }
  function csvAnnuel() {
    const head = ['Exercice', 'Mois', 'CA deploiement', 'CA abonnements', 'CA total', 'Part MRR', 'Net consultant',
      'Salaire net IR', 'Revenu total net', 'Depenses', 'Epargne', 'Clients fin', 'MRR fin', 'Heures', 'Euro/h net', 'Euro/jour'];
    const rows = R.annees.map(a => [a.annee, a.nbMois, csvNb(a.caDeploiement), csvNb(a.mrr), csvNb(a.caTotal),
      csvNb(a.partMrrDansCa * 100), csvNb(a.netIRConsultant), csvNb(a.salaireNet), csvNb(a.revenuTotalNet),
      csvNb(a.depenses), csvNb(a.epargne), csvNb(a.clientsFin), csvNb(a.mrrFin), csvNb(a.heuresTravaillees),
      csvNb(a.euroHeureNet), csvNb(a.euroJour208)].join(';'));
    telecharger('synthese-annuelle.csv', [head.join(';')].concat(rows).join('\r\n'));
  }
  function csvParams() {
    const rows = BP.PARAM_LIST.map(p => [p.groupe, '"' + p.label.replace(/"/g, '""') + '"',
      String(params[p.key]).replace('.', ','), String(p.def).replace('.', ','), p.unit].join(';'));
    telecharger('parametres.csv', ['Groupe;Parametre;Valeur;Defaut;Unite'].concat(rows).join('\r\n'));
  }
  function csvIndic() {
    const rows = listeIndicateurs().map(l => [l[0], '"' + l[1].replace(/"/g, '""') + '"',
      '"' + String(l[2]).replace(/ /g, ' ') + '"'].join(';'));
    telecharger('indicateurs.csv', ['Categorie;Indicateur;Valeur'].concat(rows).join('\r\n'));
  }
  function exportJson() {
    telecharger('parametres-consultant-ia.json',
      JSON.stringify({ version: 2, date: new Date().toISOString(), parametres: params }, null, 2),
      'application/json');
  }

  /* ======================================================================
     RECALCUL COMPLET
     ==================================================================== */
  let rafId = null;
  function appliquer() {
    // setTimeout plutôt que requestAnimationFrame : rAF est gelé dans un onglet
    // en arrière-plan, ce qui laisserait la page désynchronisée des paramètres.
    if (rafId) clearTimeout(rafId);
    rafId = setTimeout(() => {
      R = BP.compute(params);
      injecter(dictionnaire());
      tableauMrr(); tableauAnnuel(); tableauJalons(); tableauScenarios();
      tableauParams(); tableauIndicateurs();
      graphiques();
      const n = compterModifs();
      document.getElementById('paramModified').textContent =
        n === 0 ? 'aucune modification' : (n + ' paramètre' + (n > 1 ? 's' : '') + ' modifié' + (n > 1 ? 's' : ''));
      document.getElementById('paramStatus').innerHTML = n === 0
        ? 'Configuration par défaut. Les réglages sont <b>enregistrés automatiquement</b> dans ce navigateur.'
        : `<b>${n}</b> paramètre${n > 1 ? 's' : ''} personnalisé${n > 1 ? 's' : ''} — enregistré${n > 1 ? 's' : ''} pour vos prochaines visites.`;
      sauver();
    }, 16);
  }

  /* ======================================================================
     INTERFACE
     ==================================================================== */
  function ui() {
    const body = document.body;
    const burger = document.getElementById('burger');
    const scrim = document.getElementById('scrim');
    const drawer = document.getElementById('drawer');

    function toggleMenu(on) {
      const ouvert = on === undefined ? !body.classList.contains('menu-open') : on;
      body.classList.toggle('menu-open', ouvert);
      burger.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
      burger.setAttribute('aria-label', ouvert ? 'Fermer le menu' : 'Ouvrir le menu');
    }
    burger.addEventListener('click', () => toggleMenu());
    scrim.addEventListener('click', () => toggleMenu(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') toggleMenu(false); });
    drawer.querySelectorAll('a.dl').forEach(a => a.addEventListener('click', () => toggleMenu(false)));

    // panneau paramètres
    const panel = document.getElementById('paramPanel');
    const head = document.getElementById('paramHead');
    function togglePanel(on) {
      const ouvert = on === undefined ? !panel.classList.contains('is-open') : on;
      panel.classList.toggle('is-open', ouvert);
      head.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
    }
    head.addEventListener('click', e => { if (!e.target.closest('.btn')) togglePanel(); });
    head.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePanel(); } });

    document.getElementById('drawerParams').addEventListener('click', () => {
      toggleMenu(false); togglePanel(true);
      setTimeout(() => document.getElementById('parametres').scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    });
    document.getElementById('drawerExport').addEventListener('click', () => { toggleMenu(false); exportJson(); });
    document.getElementById('btnExport').addEventListener('click', exportJson);
    document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileImport').click());
    document.getElementById('fileImport').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const o = JSON.parse(fr.result);
          const src = o.parametres || o;
          const base = BP.defaults();
          Object.keys(base).forEach(k => { if (src[k] !== undefined) base[k] = src[k]; });
          params = base; rafraichirFormulaire(); appliquer();
        } catch (err) { alert("Fichier illisible : " + err.message); }
      };
      fr.readAsText(f);
      e.target.value = '';
    });
    document.getElementById('btnReset').addEventListener('click', () => {
      if (!confirm('Rétablir les ' + BP.PARAM_LIST.length + ' valeurs par défaut ?')) return;
      params = BP.defaults(); rafraichirFormulaire(); appliquer();
    });
    document.getElementById('btnCsvMrr').addEventListener('click', csvMrr);
    document.getElementById('btnCsvAn').addEventListener('click', csvAnnuel);
    document.getElementById('btnCsvParams').addEventListener('click', csvParams);
    document.getElementById('btnCsvIndic').addEventListener('click', csvIndic);

    // apparition au défilement
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.rv').forEach(n => io.observe(n));
    const ioK = new IntersectionObserver(entries => {
      entries.forEach((e, i) => { if (e.isIntersecting) { e.target.style.setProperty('--d', (i * 45) + 'ms'); e.target.classList.add('in'); ioK.unobserve(e.target); } });
    }, { threshold: 0.2 });
    document.querySelectorAll('.kpi').forEach(n => ioK.observe(n));

    // progression + bouton retour
    const prog = document.getElementById('progress');
    const totop = document.getElementById('totop');
    let ticking = false;
    function onScroll() {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
      totop.classList.toggle('on', window.scrollY > 700);
      ticking = false;
    }
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
    totop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // surlignage de la section courante
    const liens = Array.from(drawer.querySelectorAll('a.dl'));
    const cibles = liens.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const ioS = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        liens.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-25% 0px -65% 0px' });
    cibles.forEach(c => ioS.observe(c));
  }

  /* ======================================================================
     DÉMARRAGE
     ==================================================================== */
  construireFormulaire();
  appliquer();
  ui();

})();
