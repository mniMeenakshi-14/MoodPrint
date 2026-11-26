import { useApp } from '../../store.jsx';
import { EMO, EmoChip, Fig, Donut, Rich } from '../../components/ui.jsx';
import Charts from '../../lib/charts.js';
import { points, trendOf, moodOf, scoreOf, patternInsights } from '../../lib/data.js';
import { avg, DAY } from '../../lib/util.js';

export default function Patterns() {
  const { d } = useApp();
  const P = points(d), now = Date.now(), c = {};
  P.filter(p => p.ts >= now - 30 * DAY).forEach(p => { c[p.emotion] = (c[p.emotion] || 0) + 1; });
  const wk = (a, b) => P.filter(p => p.ts >= now - a * DAY && p.ts < now - b * DAY);
  const cnt = L => { const o = {}; L.forEach(p => { o[p.emotion] = (o[p.emotion] || 0) + 1; }); return o; }, ct = cnt(wk(7, 0)), cl = cnt(wk(14, 7));
  const changes = [...new Set([...Object.keys(ct), ...Object.keys(cl)])].map(k => [k, (ct[k] || 0) - (cl[k] || 0)]).filter(([, x]) => x).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6);
  const trig = {}; d.entries.forEach(e => e.emo.topics.forEach(t => (trig[t] = trig[t] || []).push(e)));
  const ins = patternInsights(d), tr = trendOf(P);
  const weeks = [5, 4, 3, 2, 1, 0].map(w => { const L = P.filter(p => p.ts >= now - (w + 1) * 7 * DAY && p.ts < now - w * 7 * DAY);
    return { label: w ? w + 'w ago' : 'This wk', pos: L.filter(p => EMO[p.emotion].v > 0).length, neg: L.filter(p => EMO[p.emotion].v < 0).length, neu: L.filter(p => !EMO[p.emotion].v).length }; });

  return <>
    <div className="grid2">
      <div className="glass card"><h3>Emotion distribution</h3><p className="small muted">Last 30 days, journal + check-ins</p><Donut counts={c} /></div>
      <div className="glass card"><h3>Positive vs heavier, by week</h3>
        <p className="small muted"><span className="dotc" style={{ background: '#34d399' }} />positive <span className="dotc" style={{ background: '#64748b' }} />neutral <span className="dotc" style={{ background: '#fb7185' }} />heavier</p>
        <Fig draw={el => Charts.weekStack(el, weeks)} deps={[d.entries, d.checkins]} /></div>
    </div>
    <div className="grid2" style={{ marginTop: 18 }}>
      <div className="glass card"><h3>Trigger identification</h3><p className="small muted">Topics in your entries and how they tend to feel</p>
        {Object.keys(trig).length ? <table className="tbl"><thead><tr><th>Topic</th><th>Entries</th><th>Usually</th><th>Avg mood</th></tr></thead><tbody>
          {Object.entries(trig).sort((a, b) => b[1].length - a[1].length).map(([t, L]) => {
            const cc = {}; L.forEach(e => { cc[moodOf(e)] = (cc[moodOf(e)] || 0) + 1; }); const top = Object.entries(cc).sort((a, b) => b[1] - a[1])[0][0];
            const sc = Math.round(avg(L.map(e => scoreOf({ emotion: moodOf(e), intensity: e.emo.intensity }))));
            return <tr key={t}><td>{t}</td><td className="num">{L.length}</td><td><EmoChip k={top} /></td><td className="num"><span className={'sc ' + (sc >= 0 ? 'up' : 'down')}>{sc > 0 ? '+' : ''}{sc}</span></td></tr>; })}
        </tbody></table> : <p className="empty">Topics appear once your entries mention things like studies, sleep or friends.</p>}
      </div>
      <div className="glass card"><h3>Changes over time</h3>
        <p className="small muted">This week compared with last week · overall trend: <b className={tr === 'heavier' ? 'down' : tr === 'improving' ? 'up' : ''}>{tr}</b></p>
        {changes.length ? changes.map(([k, x]) => <div className="chg" key={k}><EmoChip k={k} /><span className={(x > 0) === (EMO[k].v > 0) ? 'up' : 'down'}>{x > 0 ? '▲ ' + x + ' more' : '▼ ' + -x + ' fewer'}</span></div>) : <p className="muted small">Not enough data to compare weeks yet.</p>}
        <h3 style={{ marginTop: 20 }}>Emotional patterns</h3>
        {ins.length ? <ul className="ins">{ins.map((t, i) => <li key={i}><Rich text={t} /></li>)}</ul> : <p className="muted small">Patterns appear after a few entries.</p>}
      </div>
    </div>
  </>;
}
