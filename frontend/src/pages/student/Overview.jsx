import { useState } from 'react';
import { useApp } from '../../store.jsx';
import { EMO, EmoChip, IBar, Status, Fig } from '../../components/ui.jsx';
import Charts from '../../lib/charts.js';
import { points, daily, streak, moodOf } from '../../lib/data.js';
import { ago, avg, dayKey, fmtDateTime, plural, DAY } from '../../lib/util.js';

export default function Overview() {
  const { d, go, setUi, setSafety } = useApp();
  const [quick, setQuick] = useState('');
  const pts = points(d), last = pts[pts.length - 1], today = d.checkins.find(c => c.day === dayKey(Date.now()));
  const recent = [...d.entries].reverse().slice(0, 3), req = [...d.requests].sort((a, b) => b.updated - a.updated)[0];
  const replies = req ? d.messages.filter(m => m.request === req.id && m.from === 'counsellor').length : 0;
  const flagged = d.entries.some(e => e.emo.support && e.ts >= Date.now() - 3 * DAY);
  const week = daily(pts, 7).filter(x => x.n), wavg = week.length ? Math.round(avg(week.map(x => x.score))) : null, st = streak(d.checkins);

  return <>
    {flagged && <div className="glass banner">💜 Some of your recent entries sounded really heavy. You don't have to handle it alone. <button className="btn sm primary" onClick={() => setSafety(true)}>Get support</button></div>}
    <div className="grid3">
      <div className="glass card mood-now">
        <span className="small muted">Current mood</span>
        {last ? <><div className="big-emo">{EMO[last.emotion].emoji}</div><h2 style={{ color: EMO[last.emotion].color }}>{EMO[last.emotion].label}</h2>
          <div className="irow"><IBar v={last.intensity} color={EMO[last.emotion].color} /></div>
          <p className="small muted">From your {last.kind === 'checkin' ? 'daily check-in' : 'journal'} · {ago(last.ts)}</p></>
          : <><div className="big-emo">🌙</div><p className="muted">No mood recorded yet. Start with a check-in or a journal entry.</p></>}
      </div>
      <div className="glass card">
        {today ? <><span className="small muted">Today's check-in ✓</span>
          <div className="ci-done">{EMO[today.mood].emoji}<div><b>{EMO[today.mood].label}</b><small>Energy {today.energy}/5 · Sleep {today.sleep} h</small></div></div>
          <p className="small muted">🔥 {plural(st, 'day')} streak</p><button className="btn ghost sm" onClick={() => go('checkin')}>Update check-in</button></>
          : <><span className="small muted">Daily check-in</span><h2>How are you today?</h2><p className="muted">Takes 20 seconds. Your streak: {plural(st, 'day')}.</p><button className="btn primary" onClick={() => go('checkin')}>Check in now</button></>}
      </div>
      <div className="glass card">
        <span className="small muted">Quick journal entry</span>
        <textarea className="quick" placeholder="What's on your mind?" value={quick} onChange={e => setQuick(e.target.value)} />
        <button className="btn primary" onClick={() => { setUi({ draft: quick, editing: null, pick: null }); go('journal'); }}>✍️ Continue in journal</button>
      </div>
    </div>
    <div className="grid2" style={{ marginTop: 18 }}>
      <div className="glass card">
        <div className="row between"><h3>Mood this week</h3><span className="small muted">{wavg === null ? '' : 'Average ' + (wavg > 0 ? '+' : '') + wavg}</span></div>
        <p className="small muted">Green bars = lighter days, coral = heavier.</p>
        <Fig height={200} draw={el => Charts.dayBars(el, daily(points(d), 7))} deps={[d.entries, d.checkins]} />
      </div>
      <div className="glass card">
        <div className="row between"><h3>Recent entries</h3><button className="btn ghost sm" onClick={() => go('journal')}>All entries</button></div>
        {recent.length ? recent.map(e => <div className="mini-entry" key={e.id}><div><b>{fmtDateTime(e.ts)}</b><small className="mono">{e.ct.slice(0, 42)}…</small></div><EmoChip k={moodOf(e)} /></div>) : <p className="empty">No entries yet.</p>}
        <div className="row between" style={{ marginTop: 14 }}>
          <span className="small muted">Counsellor support</span>
          {req ? <span><Status s={req.status} /> {replies ? <span className="small">· {plural(replies, 'reply')}</span> : null}</span> : <button className="btn ghost sm" onClick={() => go('support')}>Reach out</button>}
        </div>
      </div>
    </div>
  </>;
}
