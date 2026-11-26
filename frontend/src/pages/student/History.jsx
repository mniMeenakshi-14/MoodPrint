import { useApp } from '../../store.jsx';
import { EmoChip, Fig, Legend } from '../../components/ui.jsx';
import Charts from '../../lib/charts.js';
import { points, daily } from '../../lib/data.js';
import { DAY, fmtDay, plural, startOfDay } from '../../lib/util.js';

export default function History() {
  const { d, ui, setUi } = useApp();
  const r = ui.range || 7, all = points(d), pts = all.filter(p => p.ts >= startOfDay(Date.now()) - (r - 1) * DAY);
  const days = daily(all, r).filter(x => x.n).reverse(), deps = [d.entries, d.checkins, r];
  return <>
    <div className="row between">
      <div className="seg"><button className={r === 7 ? 'on' : ''} onClick={() => setUi({ range: 7 })}>Week</button><button className={r === 30 ? 'on' : ''} onClick={() => setUi({ range: 30 })}>Month</button></div>
      <span className="small muted">{plural(pts.length, 'record')} in this period</span>
    </div>
    <div className="glass card" style={{ marginTop: 16 }}>
      <h3>Mood timeline</h3><p className="small muted">Higher = stronger feeling. Colour = emotion. Hover or tap a point.</p>
      <Legend keys={[...new Set(pts.map(p => p.emotion))]} />
      <Fig height={300} draw={el => Charts.timeline(el, all, r)} deps={deps} />
    </div>
    <div className="grid2" style={{ marginTop: 18 }}>
      <div className="glass card"><h3>{r === 7 ? 'Weekly' : 'Monthly'} mood graph</h3><p className="small muted">Daily mood score: above 0 lighter, below 0 heavier.</p><Fig draw={el => Charts.dayBars(el, daily(all, r))} deps={deps} /></div>
      <div className="glass card"><h3>Mood intensity</h3><p className="small muted">How strong your feelings were, whatever the emotion.</p><Fig draw={el => Charts.intensity(el, all, r)} deps={deps} /></div>
    </div>
    <div className="glass card" style={{ marginTop: 18 }}><h3>Day by day</h3>
      {days.length ? <div className="daylist">{days.map(x => { const L = pts.filter(p => p.ts >= x.ts && p.ts < x.ts + DAY);
        return <div className="dayrow" key={x.ts}><b>{fmtDay(x.ts)}</b><span className="row wrap">{L.map((p, i) => <EmoChip key={i} k={p.emotion} extra={' · ' + p.intensity} />)}</span><span className={'sc ' + (x.score >= 0 ? 'up' : 'down')}>{x.score > 0 ? '+' : ''}{x.score}</span></div>; })}</div>
        : <p className="empty">Nothing recorded in this period.</p>}
    </div>
  </>;
}
