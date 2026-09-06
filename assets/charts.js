/* ============================================================================
   charts.js — Micro-bibliothèque de graphiques SVG, sans dépendance
   Rendu net (pixel-based), responsive, animé à l'entrée dans le viewport.
   ========================================================================== */
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  const PALETTE = ['#0071e3', '#5e5ce6', '#00b8a9', '#ff9f0a', '#ff2d55', '#34c759', '#af52de', '#8e8e93'];

  /* ---------------------------------------------------------------- outils */
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function niceMax(v) {
    if (!Number.isFinite(v) || v <= 0) return 1;
    const exp = Math.floor(Math.log10(v));
    const base = Math.pow(10, exp);
    const m = v / base;
    const step = m <= 1 ? 1 : m <= 1.5 ? 1.5 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
    return step * base;
  }
  function ticks(min, max, n) {
    const out = [];
    for (let i = 0; i <= n; i++) out.push(min + (max - min) * i / n);
    return out;
  }
  function px(v) { return Math.round(v * 100) / 100; }

  /* ------------------------------------------------------ socle d'un chart */
  function makeSvg(host, h) {
    host.innerHTML = '';
    const w = Math.max(280, host.clientWidth || host.parentElement.clientWidth || 640);
    const svg = el('svg', {
      width: w, height: h, viewBox: `0 0 ${w} ${h}`,
      class: 'chart-svg', role: 'img',
      xmlns: NS,
    }, host);
    return { svg, w, h };
  }

  function tooltipFor(host) {
    let tip = host.querySelector('.chart-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip';
      host.appendChild(tip);
    }
    return tip;
  }

  function showTip(host, tip, x, y, html) {
    tip.innerHTML = html;
    tip.classList.add('is-on');
    const hw = host.clientWidth;
    const tw = tip.offsetWidth;
    let left = x - tw / 2;
    left = Math.max(4, Math.min(hw - tw - 4, left));
    tip.style.left = left + 'px';
    tip.style.top = Math.max(4, y - tip.offsetHeight - 12) + 'px';
  }
  function hideTip(tip) { tip.classList.remove('is-on'); }

  function grid(svg, pad, w, h, yT, fmtY, gridColor) {
    const g = el('g', { class: 'chart-grid' }, svg);
    yT.forEach(t => {
      const y = px(t.y);
      el('line', { x1: pad.l, y1: y, x2: w - pad.r, y2: y, stroke: gridColor || 'var(--grid)', 'stroke-width': 1 }, g);
      const tx = el('text', { x: pad.l - 10, y: y + 4, 'text-anchor': 'end', class: 'chart-axis-label' }, g);
      tx.textContent = fmtY(t.v);
    });
  }

  function reveal(host, svg) {
    svg.classList.add('chart-anim');
    if (!('IntersectionObserver' in window)) { svg.classList.add('is-drawn'); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-drawn'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    io.observe(svg);
  }

  /* =========================================================================
     LINE / AREA — séries temporelles
     opts: { labels:[], series:[{name,values,color,area,dash,width}], height,
             fmtY, fmtTip, xEvery, yMin, yZero, markers:[{i,label}] }
     ======================================================================= */
  function line(host, opts) {
    const h = opts.height || 320;
    const { svg, w } = makeSvg(host, h);
    const pad = { t: 18, r: 16, b: 34, l: opts.padLeft || 62 };
    const labels = opts.labels || [];
    const n = labels.length;
    if (!n) return;
    const fmtY = opts.fmtY || (v => Math.round(v));
    const series = opts.series || [];

    let vmax = -Infinity, vmin = Infinity;
    series.forEach(s => s.values.forEach(v => { if (Number.isFinite(v)) { vmax = Math.max(vmax, v); vmin = Math.min(vmin, v); } }));
    if (!Number.isFinite(vmax)) return;
    const yMin = opts.yMin !== undefined ? opts.yMin : (opts.yZero === false ? vmin - (vmax - vmin) * 0.1 : Math.min(0, vmin));
    const yMax = niceMax(vmax * 1.06);

    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const X = i => pad.l + (n === 1 ? iw / 2 : iw * i / (n - 1));
    const Y = v => pad.t + ih - ih * (v - yMin) / (yMax - yMin || 1);

    grid(svg, pad, w, h, ticks(yMin, yMax, 5).map(v => ({ v, y: Y(v) })), fmtY);

    // axe X
    const gx = el('g', {}, svg);
    const every = opts.xEvery || Math.max(1, Math.ceil(n / (w < 520 ? 5 : 12)));
    labels.forEach((lb, i) => {
      if (i % every !== 0 && i !== n - 1) return;
      const t = el('text', { x: px(X(i)), y: h - 12, 'text-anchor': 'middle', class: 'chart-axis-label' }, gx);
      t.textContent = lb;
    });

    // marqueurs verticaux (jalons)
    (opts.markers || []).forEach(mk => {
      const x = px(X(mk.i));
      el('line', { x1: x, y1: pad.t, x2: x, y2: pad.t + ih, stroke: mk.color || 'var(--mark)', 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }, svg);
      const t = el('text', { x: x + 5, y: pad.t + 12, class: 'chart-mark-label', fill: mk.color || 'var(--mark)' }, svg);
      t.textContent = mk.label;
    });

    // séries
    series.forEach((s, si) => {
      const color = s.color || PALETTE[si % PALETTE.length];
      const pts = s.values.map((v, i) => [X(i), Y(v)]);
      const d = pts.map((p2, i) => (i ? 'L' : 'M') + px(p2[0]) + ' ' + px(p2[1])).join(' ');
      if (s.area) {
        const gid = 'grad-' + Math.random().toString(36).slice(2, 8);
        const defs = el('defs', {}, svg);
        const lg = el('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
        el('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.28 }, lg);
        el('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0.01 }, lg);
        el('path', { d: d + ` L ${px(X(n - 1))} ${px(Y(yMin))} L ${px(X(0))} ${px(Y(yMin))} Z`, fill: `url(#${gid})`, class: 'chart-area' }, svg);
      }
      const path = el('path', {
        d, fill: 'none', stroke: color, 'stroke-width': s.width || 2.6,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        'stroke-dasharray': s.dash || null, class: 'chart-line',
      }, svg);
      if (!s.dash) {
        const len = path.getTotalLength ? path.getTotalLength() : 2000;
        path.style.setProperty('--len', len);
        path.setAttribute('stroke-dasharray', len);
        path.setAttribute('stroke-dashoffset', len);
      }
      if (s.lastDot !== false) {
        el('circle', { cx: px(X(n - 1)), cy: px(Y(s.values[n - 1])), r: 4.5, fill: color, class: 'chart-dot' }, svg);
      }
    });

    // interaction
    const tip = tooltipFor(host);
    const hover = el('g', { class: 'chart-hover' }, svg);
    const hl = el('line', { x1: 0, y1: pad.t, x2: 0, y2: pad.t + ih, stroke: 'var(--hover-line)', 'stroke-width': 1, opacity: 0 }, hover);
    const dots = series.map((s, si) => el('circle', { r: 5, fill: '#fff', stroke: s.color || PALETTE[si % PALETTE.length], 'stroke-width': 2.5, opacity: 0 }, hover));
    const hit = el('rect', { x: pad.l, y: pad.t, width: iw, height: ih, fill: 'transparent' }, svg);
    hit.addEventListener('pointermove', ev => {
      const r = svg.getBoundingClientRect();
      const mx = ev.clientX - r.left;
      let i = Math.round((mx - pad.l) / (iw / Math.max(1, n - 1)));
      i = Math.max(0, Math.min(n - 1, i));
      hl.setAttribute('x1', px(X(i))); hl.setAttribute('x2', px(X(i))); hl.setAttribute('opacity', 1);
      let html = '<b>' + (opts.tipTitles ? opts.tipTitles[i] : labels[i]) + '</b>';
      series.forEach((s, si) => {
        dots[si].setAttribute('cx', px(X(i))); dots[si].setAttribute('cy', px(Y(s.values[i]))); dots[si].setAttribute('opacity', 1);
        html += `<span><i style="background:${s.color || PALETTE[si % PALETTE.length]}"></i>${s.name} <b>${(opts.fmtTip || fmtY)(s.values[i])}</b></span>`;
      });
      showTip(host, tip, X(i), Y(Math.max.apply(null, series.map(s => s.values[i]))), html);
    });
    hit.addEventListener('pointerleave', () => { hl.setAttribute('opacity', 0); dots.forEach(d => d.setAttribute('opacity', 0)); hideTip(tip); });

    reveal(host, svg);
    if (opts.legend !== false) legend(host, series.map((s, i) => ({ name: s.name, color: s.color || PALETTE[i % PALETTE.length], dash: s.dash })));
  }

  /* =========================================================================
     BARRES empilées / groupées
     opts: { labels, series:[{name,values,color}], stacked, height, fmtY, fmtTip }
     ======================================================================= */
  function bars(host, opts) {
    const h = opts.height || 320;
    const { svg, w } = makeSvg(host, h);
    const pad = { t: 18, r: 16, b: 36, l: opts.padLeft || 62 };
    const labels = opts.labels || [];
    const n = labels.length;
    if (!n) return;
    const series = opts.series || [];
    const stacked = opts.stacked !== false;
    const fmtY = opts.fmtY || (v => Math.round(v));

    let vmax = 0, vmin = 0;
    if (stacked) {
      for (let i = 0; i < n; i++) {
        let pos = 0, neg = 0;
        series.forEach(s => { const v = s.values[i] || 0; if (v >= 0) pos += v; else neg += v; });
        vmax = Math.max(vmax, pos); vmin = Math.min(vmin, neg);
      }
    } else {
      series.forEach(s => s.values.forEach(v => { vmax = Math.max(vmax, v); vmin = Math.min(vmin, v); }));
    }
    const yMax = niceMax(vmax * 1.08) || 1;
    const yMin = vmin < 0 ? -niceMax(-vmin * 1.08) : 0;

    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const Y = v => pad.t + ih - ih * (v - yMin) / (yMax - yMin || 1);
    const slot = iw / n;
    const bw = stacked ? Math.min(46, slot * 0.62) : Math.min(28, (slot * 0.72) / series.length);

    grid(svg, pad, w, h, ticks(yMin, yMax, 5).map(v => ({ v, y: Y(v) })), fmtY);

    const gx = el('g', {}, svg);
    const every = Math.max(1, Math.ceil(n / (w < 520 ? 6 : 14)));
    labels.forEach((lb, i) => {
      if (i % every !== 0 && i !== n - 1) return;
      const t = el('text', { x: px(pad.l + slot * (i + 0.5)), y: h - 13, 'text-anchor': 'middle', class: 'chart-axis-label' }, gx);
      t.textContent = lb;
    });

    const gb = el('g', { class: 'chart-bars' }, svg);
    for (let i = 0; i < n; i++) {
      let accP = 0, accN = 0;
      series.forEach((s, si) => {
        const v = s.values[i] || 0;
        const color = s.color || PALETTE[si % PALETTE.length];
        let x, y, hh;
        if (stacked) {
          x = pad.l + slot * (i + 0.5) - bw / 2;
          if (v >= 0) { y = Y(accP + v); hh = Y(accP) - Y(accP + v); accP += v; }
          else { y = Y(accN); hh = Y(accN + v) - Y(accN); accN += v; }
        } else {
          const groupW = bw * series.length + 3 * (series.length - 1);
          x = pad.l + slot * (i + 0.5) - groupW / 2 + si * (bw + 3);
          y = Math.min(Y(v), Y(0)); hh = Math.abs(Y(v) - Y(0));
        }
        const r = el('rect', {
          x: px(x), y: px(y), width: px(bw), height: px(Math.max(0, hh)),
          rx: Math.min(4, bw / 3), fill: color, class: 'chart-bar',
        }, gb);
        r.style.setProperty('--delay', (i * 14 + si * 40) + 'ms');
        r.style.setProperty('--oy', px(Y(0)) + 'px');
      });
    }

    const tip = tooltipFor(host);
    const hit = el('rect', { x: pad.l, y: pad.t, width: iw, height: ih, fill: 'transparent' }, svg);
    hit.addEventListener('pointermove', ev => {
      const r = svg.getBoundingClientRect();
      let i = Math.floor((ev.clientX - r.left - pad.l) / slot);
      i = Math.max(0, Math.min(n - 1, i));
      let html = '<b>' + (opts.tipTitles ? opts.tipTitles[i] : labels[i]) + '</b>';
      let tot = 0;
      series.forEach((s, si) => {
        tot += s.values[i] || 0;
        html += `<span><i style="background:${s.color || PALETTE[si % PALETTE.length]}"></i>${s.name} <b>${(opts.fmtTip || fmtY)(s.values[i])}</b></span>`;
      });
      if (stacked && series.length > 1) html += `<span class="tot">Total <b>${(opts.fmtTip || fmtY)(tot)}</b></span>`;
      showTip(host, tip, pad.l + slot * (i + 0.5), pad.t + 20, html);
    });
    hit.addEventListener('pointerleave', () => hideTip(tip));

    reveal(host, svg);
    if (opts.legend !== false) legend(host, series.map((s, i) => ({ name: s.name, color: s.color || PALETTE[i % PALETTE.length] })));
  }

  /* =========================================================================
     BARRES HORIZONTALES — comparatifs
     opts: { items:[{name,value,color,note}], fmt, height }
     ======================================================================= */
  function barsH(host, opts) {
    const items = opts.items || [];
    const rowH = opts.rowH || 42;
    const h = items.length * rowH + 24;
    const { svg, w } = makeSvg(host, h);
    const padL = opts.padLeft || Math.min(210, Math.max(120, w * 0.34));
    const padR = 74;
    const iw = w - padL - padR;
    const vmax = niceMax(Math.max.apply(null, items.map(i => Math.abs(i.value))) * 1.02) || 1;
    const fmt = opts.fmt || (v => Math.round(v));

    items.forEach((it, i) => {
      const y = 12 + i * rowH;
      const bh = Math.min(22, rowH - 16);
      const lab = el('text', { x: padL - 12, y: y + bh / 2 + 4, 'text-anchor': 'end', class: 'chart-axis-label strong' }, svg);
      lab.textContent = it.name;
      el('rect', { x: padL, y: py(y), width: iw, height: bh, rx: bh / 2, fill: 'var(--track)' }, svg);
      const bw = Math.max(2, iw * Math.abs(it.value) / vmax);
      const r = el('rect', { x: padL, y: py(y), width: px(bw), height: bh, rx: bh / 2, fill: it.color || PALETTE[i % PALETTE.length], class: 'chart-barh' }, svg);
      r.style.setProperty('--delay', (i * 70) + 'ms');
      r.style.setProperty('--w', px(bw) + 'px');
      const val = el('text', { x: padL + bw + 10, y: y + bh / 2 + 4, class: 'chart-value' }, svg);
      val.textContent = fmt(it.value);
    });
    function py(v) { return px(v); }
    reveal(host, svg);
  }

  /* =========================================================================
     DONUT
     opts: { items:[{name,value,color}], fmt, height, centre:{haut,bas} }
     ======================================================================= */
  function donut(host, opts) {
    const h = opts.height || 300;
    const { svg, w } = makeSvg(host, h);
    const items = (opts.items || []).filter(i => i.value > 0);
    const total = items.reduce((s, i) => s + i.value, 0) || 1;
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 14, r = R * 0.62;
    const fmt = opts.fmt || (v => Math.round(v));

    let a0 = -Math.PI / 2;
    const g = el('g', { class: 'chart-donut' }, svg);
    items.forEach((it, i) => {
      const a1 = a0 + 2 * Math.PI * it.value / total;
      const large = (a1 - a0) > Math.PI ? 1 : 0;
      const p = [
        'M', px(cx + R * Math.cos(a0)), px(cy + R * Math.sin(a0)),
        'A', R, R, 0, large, 1, px(cx + R * Math.cos(a1)), px(cy + R * Math.sin(a1)),
        'L', px(cx + r * Math.cos(a1)), px(cy + r * Math.sin(a1)),
        'A', r, r, 0, large, 0, px(cx + r * Math.cos(a0)), px(cy + r * Math.sin(a0)), 'Z',
      ].join(' ');
      const path = el('path', { d: p, fill: it.color || PALETTE[i % PALETTE.length], class: 'chart-slice' }, g);
      path.style.setProperty('--delay', (i * 90) + 'ms');
      path.addEventListener('pointerenter', () => {
        showTip(host, tip, cx + (R + r) / 2 * Math.cos((a0 + a1) / 2), cy + (R + r) / 2 * Math.sin((a0 + a1) / 2),
          `<b>${it.name}</b><span>${fmt(it.value)} · <b>${(100 * it.value / total).toFixed(1).replace('.', ',')} %</b></span>`);
      });
      path.addEventListener('pointerleave', () => hideTip(tip));
      a0 = a1;
    });
    const tip = tooltipFor(host);

    if (opts.centre) {
      const t1 = el('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', class: 'donut-center-1' }, svg);
      t1.textContent = opts.centre.haut;
      const t2 = el('text', { x: cx, y: cy + 20, 'text-anchor': 'middle', class: 'donut-center-2' }, svg);
      t2.textContent = opts.centre.bas;
    }
    reveal(host, svg);
    legend(host, items.map((it, i) => ({ name: it.name + ' — ' + fmt(it.value), color: it.color || PALETTE[i % PALETTE.length] })));
  }

  /* =========================================================================
     WATERFALL (CA -> net)
     opts: { items:[{name,value,type:'start'|'delta'|'total',color}], fmt }
     ======================================================================= */
  function waterfall(host, opts) {
    const h = opts.height || 320;
    const { svg, w } = makeSvg(host, h);
    const pad = { t: 26, r: 16, b: 48, l: opts.padLeft || 68 };
    const items = opts.items || [];
    const n = items.length;
    const fmt = opts.fmt || (v => Math.round(v));

    let cur = 0, vmax = 0, vmin = 0;
    const geo = items.map(it => {
      let from, to;
      if (it.type === 'delta') { from = cur; to = cur + it.value; cur = to; }
      else { from = 0; to = it.value; cur = it.value; }
      vmax = Math.max(vmax, from, to); vmin = Math.min(vmin, from, to);
      return { from, to };
    });
    const yMax = niceMax(vmax * 1.1) || 1;
    const yMin = vmin < 0 ? -niceMax(-vmin * 1.15) : 0;
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const Y = v => pad.t + ih - ih * (v - yMin) / (yMax - yMin || 1);
    const slot = iw / n;
    const bw = Math.min(56, slot * 0.6);

    grid(svg, pad, w, h, ticks(yMin, yMax, 5).map(v => ({ v, y: Y(v) })), fmt);

    items.forEach((it, i) => {
      const gm = geo[i];
      const x = pad.l + slot * (i + 0.5) - bw / 2;
      const y = Math.min(Y(gm.from), Y(gm.to));
      const hh = Math.max(2, Math.abs(Y(gm.to) - Y(gm.from)));
      const color = it.color || (it.type === 'delta' ? (it.value >= 0 ? '#34c759' : '#ff3b30') : '#0071e3');
      const r = el('rect', { x: px(x), y: px(y), width: px(bw), height: px(hh), rx: 4, fill: color, class: 'chart-bar' }, svg);
      r.style.setProperty('--delay', (i * 90) + 'ms');
      r.style.setProperty('--oy', px(y + hh) + 'px');
      if (i < n - 1) {
        el('line', { x1: px(x + bw), y1: px(Y(gm.to)), x2: px(x + slot), y2: px(Y(gm.to)), stroke: 'var(--grid-strong)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }, svg);
      }
      const vt = el('text', { x: px(x + bw / 2), y: px(y - 7), 'text-anchor': 'middle', class: 'chart-value small' }, svg);
      vt.textContent = (it.type === 'delta' && it.value > 0 ? '+' : '') + fmt(it.value);
      const lt = el('text', { x: px(pad.l + slot * (i + 0.5)), y: h - 26, 'text-anchor': 'middle', class: 'chart-axis-label' }, svg);
      lt.textContent = it.name;
      if (it.sous) {
        const st = el('text', { x: px(pad.l + slot * (i + 0.5)), y: h - 11, 'text-anchor': 'middle', class: 'chart-axis-label muted' }, svg);
        st.textContent = it.sous;
      }
    });
    reveal(host, svg);
  }

  /* =========================================================================
     HEATMAP — analyse de sensibilité
     ======================================================================= */
  function heatmap(host, opts) {
    const rows = opts.lignes, cols = opts.colonnes, vals = opts.valeurs;
    const cellH = opts.cellH || 46;
    const h = rows.length * cellH + 62;
    const { svg, w } = makeSvg(host, h);
    const padL = opts.padLeft || Math.min(150, Math.max(96, w * 0.22));
    const padT = 42, padR = 8;
    const cw = (w - padL - padR) / cols.length;
    let vmin = Infinity, vmax = -Infinity;
    vals.forEach(r => r.forEach(v => { vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); }));
    const fmt = opts.fmt || (v => Math.round(v));

    // en-têtes colonnes
    cols.forEach((c, j) => {
      const t = el('text', { x: px(padL + cw * (j + 0.5)), y: 26, 'text-anchor': 'middle', class: 'chart-axis-label strong' }, svg);
      t.textContent = opts.fmtColonne ? opts.fmtColonne(c) : c;
    });
    const th = el('text', { x: padL - 10, y: 26, 'text-anchor': 'end', class: 'chart-axis-label muted' }, svg);
    th.textContent = opts.labelColonnes || '';

    rows.forEach((rv, i) => {
      const y = padT + i * cellH;
      const t = el('text', { x: padL - 10, y: y + cellH / 2 + 4, 'text-anchor': 'end', class: 'chart-axis-label strong' }, svg);
      t.textContent = opts.fmtLigne ? opts.fmtLigne(rv) : rv;
      cols.forEach((cv, j) => {
        const v = vals[i][j];
        const k = (vmax - vmin) > 0 ? (v - vmin) / (vmax - vmin) : 0.5;
        const cell = el('rect', {
          x: px(padL + cw * j + 2), y: px(y + 2), width: px(cw - 4), height: px(cellH - 4), rx: 8,
          fill: heatColor(k), class: 'chart-cell',
        }, svg);
        cell.style.setProperty('--delay', ((i + j) * 26) + 'ms');
        const tv = el('text', {
          x: px(padL + cw * (j + 0.5)), y: px(y + cellH / 2 + 4), 'text-anchor': 'middle',
          class: 'chart-cell-label', fill: k > 0.58 ? '#fff' : '#1d1d1f',
        }, svg);
        tv.textContent = fmt(v);
      });
    });
    reveal(host, svg);
  }
  function heatColor(k) {
    // dégradé bleu clair -> bleu Apple -> indigo
    const stops = [[240, 247, 255], [199, 224, 252], [138, 190, 248], [64, 143, 232], [0, 113, 227], [61, 47, 190]];
    const t = Math.max(0, Math.min(0.999, k)) * (stops.length - 1);
    const i = Math.floor(t), f = t - i;
    const a = stops[i], b = stops[Math.min(stops.length - 1, i + 1)];
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
  }

  /* =========================================================================
     JAUGE radiale — taux de charge
     ======================================================================= */
  function gauge(host, opts) {
    const h = opts.height || 210;
    const { svg, w } = makeSvg(host, h);
    const cx = w / 2, cy = h - 22, R = Math.min(w / 2 - 16, h - 46);
    const th = Math.max(14, R * 0.19);
    const val = Math.max(0, Math.min(opts.max || 1.5, opts.value));
    const max = opts.max || 1.5;

    function arc(a0, a1, rad) {
      const large = (a1 - a0) > Math.PI ? 1 : 0;
      return `M ${px(cx + rad * Math.cos(a0))} ${px(cy + rad * Math.sin(a0))} A ${rad} ${rad} 0 ${large} 1 ${px(cx + rad * Math.cos(a1))} ${px(cy + rad * Math.sin(a1))}`;
    }
    const A0 = Math.PI, A1 = 2 * Math.PI;
    el('path', { d: arc(A0, A1, R - th / 2), fill: 'none', stroke: 'var(--track)', 'stroke-width': th, 'stroke-linecap': 'round' }, svg);
    const aEnd = A0 + (A1 - A0) * (val / max);
    const p = el('path', {
      d: arc(A0, Math.max(A0 + 0.001, aEnd), R - th / 2), fill: 'none',
      stroke: opts.color || '#0071e3', 'stroke-width': th, 'stroke-linecap': 'round', class: 'chart-line',
    }, svg);
    const len = p.getTotalLength ? p.getTotalLength() : 500;
    p.setAttribute('stroke-dasharray', len); p.setAttribute('stroke-dashoffset', len);

    // repère 100 %
    if (opts.repere) {
      const ar = A0 + (A1 - A0) * (opts.repere / max);
      el('line', {
        x1: px(cx + (R - th) * Math.cos(ar)), y1: px(cy + (R - th) * Math.sin(ar)),
        x2: px(cx + R * Math.cos(ar)), y2: px(cy + R * Math.sin(ar)),
        stroke: 'var(--ink)', 'stroke-width': 2,
      }, svg);
    }
    const t1 = el('text', { x: cx, y: cy - 14, 'text-anchor': 'middle', class: 'gauge-value' }, svg);
    t1.textContent = opts.label;
    const t2 = el('text', { x: cx, y: cy + 8, 'text-anchor': 'middle', class: 'gauge-sub' }, svg);
    t2.textContent = opts.sub || '';
    reveal(host, svg);
  }

  /* =========================================================================
     SPARKLINE compacte (dans les cartes KPI)
     ======================================================================= */
  function spark(host, values, color) {
    const h = 40;
    const { svg, w } = makeSvg(host, h);
    const vmax = Math.max.apply(null, values), vmin = Math.min.apply(null, values);
    const X = i => 2 + (w - 4) * i / Math.max(1, values.length - 1);
    const Y = v => h - 4 - (h - 8) * (v - vmin) / ((vmax - vmin) || 1);
    const d = values.map((v, i) => (i ? 'L' : 'M') + px(X(i)) + ' ' + px(Y(v))).join(' ');
    const c = color || '#0071e3';
    el('path', { d: d + ` L ${px(X(values.length - 1))} ${h} L ${px(X(0))} ${h} Z`, fill: c, opacity: 0.1 }, svg);
    el('path', { d, fill: 'none', stroke: c, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    el('circle', { cx: px(X(values.length - 1)), cy: px(Y(values[values.length - 1])), r: 3, fill: c }, svg);
  }

  /* ------------------------------------------------------------- légendes */
  function legend(host, items) {
    const old = host.querySelector('.chart-legend');
    if (old) old.remove();
    const div = document.createElement('div');
    div.className = 'chart-legend';
    items.forEach(it => {
      const s = document.createElement('span');
      s.innerHTML = `<i style="background:${it.color};${it.dash ? 'opacity:.55' : ''}"></i>${it.name}`;
      div.appendChild(s);
    });
    host.appendChild(div);
  }

  /* ------------------------------------------- redraw responsive (debounce) */
  const registry = [];
  function register(host, fn) {
    registry.push({ host, fn });
    fn();
  }
  let t = null, lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - lastW) < 24) return;
    lastW = window.innerWidth;
    clearTimeout(t);
    t = setTimeout(() => registry.forEach(r => { try { r.fn(); } catch (e) { /* noop */ } }), 180);
  });
  function clearRegistry() { registry.length = 0; }

  global.Charts = { line, bars, barsH, donut, waterfall, heatmap, gauge, spark, register, clearRegistry, PALETTE };

})(window);
