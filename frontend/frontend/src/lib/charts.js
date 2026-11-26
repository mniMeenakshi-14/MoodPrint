import { esc, DAY, startOfDay, fmtDateTime, fmtDay, plural } from './util.js';
import Emotion from './emotion.js';

// ============================================================
// MOOD CHARTS (plain SVG, works offline, redraws on resize)
// ============================================================
const Charts = (() => {
  const EM = () => Emotion.EMO;
  const ink = 'currentColor';
  const ro = new ResizeObserver(es => es.forEach(e => e.target._draw && e.target._draw()));
  function mount(fig, draw) { fig._draw = () => { if (fig.clientWidth) draw(fig.clientWidth, fig.clientHeight); }; ro.observe(fig); fig._draw(); }

  function tipAt(fig, html, x, y) {
    let t = fig.querySelector('.tip'); if (!t) { t = document.createElement('div'); t.className = 'tip'; fig.appendChild(t); }
    t.innerHTML = html; t.hidden = false;
    const W = fig.clientWidth, tw = t.offsetWidth, th = t.offsetHeight;
    t.style.left = Math.min(Math.max(x - tw / 2, 0), W - tw) + 'px';
    t.style.top = (y - th - 12 < 0 ? y + 14 : y - th - 12) + 'px';
  }
  function bindTips(fig, sel, html) {
    fig.querySelectorAll(sel).forEach(n => {
      const show = () => tipAt(fig, html(n), +n.dataset.x, +n.dataset.y);
      n.addEventListener('mouseenter', show); n.addEventListener('focus', show);
      n.addEventListener('click', ev => { ev.stopPropagation(); show(); });
      n.addEventListener('mouseleave', () => { const t = fig.querySelector('.tip'); if (t) t.hidden = true; });
    });
  }
  const empty = (W, H, msg) => `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${ink}" opacity=".55" font-size="14">${esc(msg)}</text>`;
  const yAxis = (P, W, y, ticks, fmt) => ticks.map(v => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke="${ink}" opacity="${v === 0 ? .28 : .08}"/><text x="${P.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="${ink}" opacity=".6">${fmt ? fmt(v) : v}</text>`).join('');

  // ---- Mood timeline: dates along the bottom, intensity 0-100 up the side, colour = emotion
  function timeline(fig, pts, range) {
    mount(fig, (W, H) => {
      const svg = fig.querySelector('svg');
      const to = startOfDay(Date.now()) + DAY, from = to - range * DAY;
      const L = pts.filter(p => p.ts >= from && p.ts < to).sort((a, b) => a.ts - b.ts);
      if (!L.length) { svg.innerHTML = empty(W, H, 'No moods recorded in this period yet'); return; }
      const small = W < 520, P = { l: 44, r: 14, t: 12, b: 34 };
      const x = t => P.l + (t - from) / (to - from) * (W - P.l - P.r), y = v => P.t + (1 - v / 100) * (H - P.t - P.b);
      let g = yAxis(P, W, y, [0, 25, 50, 75, 100]);
      g += `<text transform="translate(11 ${(P.t + H - P.b) / 2}) rotate(-90)" text-anchor="middle" font-size="11" fill="${ink}" opacity=".6">Intensity</text>`;
      const nLab = Math.min(range, Math.floor((W - P.l - P.r) / (small ? 58 : 70)));
      for (let i = 0; i < nLab; i++) { const t = from + (i + 0.5) * (to - from) / nLab; g += `<text x="${x(t)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="${ink}" opacity=".6">${new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</text>`; }
      if (L.length > 1) g += `<polyline points="${L.map(p => x(p.ts) + ',' + y(p.intensity)).join(' ')}" fill="none" stroke="${ink}" stroke-opacity=".16" stroke-width="2"/>`;
      g += L.map((p, i) => { const cx = x(p.ts), cy = y(p.intensity), c = EM()[p.emotion].color;
        return p.kind === 'checkin'
          ? `<rect class="pt" data-i="${i}" data-x="${cx}" data-y="${cy}" x="${cx - 6}" y="${cy - 6}" width="12" height="12" rx="3" fill="${c}" stroke="#0b0d1a" stroke-width="2" tabindex="0"/>`
          : `<circle class="pt" data-i="${i}" data-x="${cx}" data-y="${cy}" cx="${cx}" cy="${cy}" r="7" fill="${c}" stroke="#0b0d1a" stroke-width="2" tabindex="0"/>`; }).join('');
      svg.innerHTML = g;
      bindTips(fig, '.pt', n => { const p = L[+n.dataset.i], m = EM()[p.emotion];
        return `<b>${esc(fmtDateTime(p.ts))}</b><span>${m.emoji} ${esc(m.label)} · ${p.intensity}/100</span><small>${p.kind === 'checkin' ? 'Daily check-in' : 'Journal entry'}${p.corrected ? ' · corrected by you' : ''}</small>`; });
    });
  }

  // ---- Daily mood bars: one bar per day, above 0 = lighter, below = heavier
  function dayBars(fig, days) {
    mount(fig, (W, H) => {
      const svg = fig.querySelector('svg');
      if (!days.some(d => d.n)) { svg.innerHTML = empty(W, H, 'No moods recorded in this period yet'); return; }
      const P = { l: 44, r: 10, t: 12, b: 30 }, n = days.length, bw = (W - P.l - P.r) / n;
      const y = v => P.t + (1 - (v + 100) / 200) * (H - P.t - P.b);
      let g = yAxis(P, W, y, [-100, -50, 0, 50, 100], v => v > 0 ? '+' + v : v);
      const every = Math.ceil(n / Math.floor((W - P.l - P.r) / 44));
      days.forEach((d, i) => {
        const cx = P.l + i * bw + bw / 2;
        if (i % every === 0) g += `<text x="${cx}" y="${H - 10}" text-anchor="middle" font-size="11" fill="${ink}" opacity=".6">${n <= 7 ? new Date(d.ts).toLocaleDateString(undefined, { weekday: 'short' }) : new Date(d.ts).getDate()}</text>`;
        if (!d.n) return;
        const top = Math.min(y(d.score), y(0)), h = Math.max(2, Math.abs(y(d.score) - y(0))), w = Math.max(3, bw * 0.62);
        g += `<rect class="bar" data-i="${i}" data-x="${cx}" data-y="${top}" x="${cx - w / 2}" y="${top}" width="${w}" height="${h}" rx="${Math.min(5, w / 2)}" fill="${d.score >= 0 ? '#34d399' : '#fb7185'}" tabindex="0"/>`;
      });
      svg.innerHTML = g;
      bindTips(fig, '.bar', b => { const d = days[+b.dataset.i], m = EM()[d.top];
        return `<b>${esc(fmtDay(d.ts))}</b><span>Mood score ${d.score > 0 ? '+' : ''}${d.score}</span><small>${m.emoji} mostly ${esc(m.label)} · ${plural(d.n, 'record')}</small>`; });
    });
  }

  // ---- Intensity over time (area)
  function intensity(fig, pts, range) {
    mount(fig, (W, H) => {
      const svg = fig.querySelector('svg');
      const to = startOfDay(Date.now()) + DAY, from = to - range * DAY;
      const L = pts.filter(p => p.ts >= from && p.ts < to).sort((a, b) => a.ts - b.ts);
      if (L.length < 2) { svg.innerHTML = empty(W, H, 'Needs at least two records in this period'); return; }
      const P = { l: 44, r: 12, t: 12, b: 26 };
      const x = t => P.l + (t - from) / (to - from) * (W - P.l - P.r), y = v => P.t + (1 - v / 100) * (H - P.t - P.b);
      const line = L.map(p => x(p.ts) + ',' + y(p.intensity)).join(' L');
      svg.innerHTML = `<defs><linearGradient id="ig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a78bfa" stop-opacity=".45"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></linearGradient></defs>`
        + yAxis(P, W, y, [0, 50, 100])
        + `<path d="M${x(L[0].ts)},${y(0)} L${line} L${x(L[L.length - 1].ts)},${y(0)}Z" fill="url(#ig)"/><path d="M${line}" fill="none" stroke="#a78bfa" stroke-width="2.5" stroke-linejoin="round"/>`;
    });
  }

  // ---- Positive / negative per week (stacked)
  function weekStack(fig, weeks) {
    mount(fig, (W, H) => {
      const svg = fig.querySelector('svg');
      if (!weeks.some(w => w.pos + w.neg + w.neu)) { svg.innerHTML = empty(W, H, 'Nothing recorded yet'); return; }
      const P = { l: 34, r: 10, t: 12, b: 30 }, n = weeks.length, bw = (W - P.l - P.r) / n;
      const max = Math.max(...weeks.map(w => w.pos + w.neg + w.neu));
      const y = v => P.t + (1 - v / max) * (H - P.t - P.b);
      let g = yAxis(P, W, y, [0, Math.round(max / 2), max]);
      weeks.forEach((w, i) => {
        const cx = P.l + i * bw + bw / 2, bwid = Math.min(46, bw * .6); let acc = 0;
        [['pos', '#34d399'], ['neu', '#64748b'], ['neg', '#fb7185']].forEach(([k, c]) => { if (!w[k]) return;
          g += `<rect x="${cx - bwid / 2}" y="${y(acc + w[k])}" width="${bwid}" height="${y(acc) - y(acc + w[k])}" fill="${c}" rx="3"/>`; acc += w[k]; });
        g += `<text x="${cx}" y="${H - 10}" text-anchor="middle" font-size="11" fill="${ink}" opacity=".6">${esc(w.label)}</text>`;
      });
      svg.innerHTML = g;
    });
  }

  // ---- Emotion distribution donut (returns HTML)
  function donut(counts) {
    const E = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const total = E.reduce((t, [, n]) => t + n, 0);
    if (!total) return '<p class="empty">Nothing recorded yet.</p>';
    let a0 = -Math.PI / 2, arcs = '';
    const R = 70, r = 46, C = 90;
    E.forEach(([k, n]) => {
      const a1 = a0 + n / total * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, f = Math.min(a1 - a0, Math.PI * 2 - 1e-4) + a0;
      const p = (rad, ang) => [C + rad * Math.cos(ang), C + rad * Math.sin(ang)].map(v => v.toFixed(2)).join(',');
      arcs += `<path d="M${p(R, a0)} A${R},${R} 0 ${big} 1 ${p(R, f)} L${p(r, f)} A${r},${r} 0 ${big} 0 ${p(r, a0)}Z" fill="${EM()[k].color}"><title>${EM()[k].label}: ${n}</title></path>`;
      a0 = a1;
    });
    const top = EM()[E[0][0]];
    return `<div class="donut"><svg viewBox="0 0 180 180" role="img" aria-label="Emotion distribution">${arcs}<text x="90" y="86" text-anchor="middle" font-size="26">${top.emoji}</text><text x="90" y="110" text-anchor="middle" font-size="12" fill="currentColor" opacity=".75">${Math.round(E[0][1] / total * 100)}% ${esc(top.label)}</text></svg>
      <ul class="dl">${E.map(([k, n]) => `<li><i style="background:${EM()[k].color}"></i>${EM()[k].emoji} ${esc(EM()[k].label)}<b>${Math.round(n / total * 100)}%</b></li>`).join('')}</ul></div>`;
  }

  // ---- tiny sparkline (returns SVG string)
  function spark(vals, color = '#a78bfa') {
    if (vals.filter(v => v != null).length < 2) return '<span class="muted small">Not enough data yet</span>';
    const pts = vals.map((v, i) => v == null ? null : [i / (vals.length - 1) * 100, 30 - (v + 100) / 200 * 28]).filter(Boolean);
    return `<svg class="spark" viewBox="0 0 100 32" preserveAspectRatio="none"><line x1="0" x2="100" y1="16" y2="16" stroke="currentColor" opacity=".15" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/><polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }

  // ---- emotion legend
  const legend = keys => Emotion.KEYS.filter(k => keys.includes(k)).map(k => `<span class="lg"><i style="background:${EM()[k].color}"></i>${EM()[k].emoji} ${esc(EM()[k].label)}</span>`).join('');

  document.addEventListener('click', e => { if (!e.target.closest('.fig')) document.querySelectorAll('.fig .tip').forEach(t => { t.hidden = true; }); });
  return { timeline, dayBars, intensity, weekStack, donut, spark, legend };
})();

export default Charts;
