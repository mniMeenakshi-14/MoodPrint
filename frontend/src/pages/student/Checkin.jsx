import { useState } from 'react';
import { useApp } from '../../store.jsx';
import { EMO } from '../../components/ui.jsx';
import Emotion from '../../lib/emotion.js';
import Vault from '../../lib/vault.js';
import API from '../../lib/api.js';
import { streak } from '../../lib/data.js';
import { dayKey, fmtDay, plural } from '../../lib/util.js';

export default function Checkin() {
  const { d, dRef, commit, refreshShares, toast, setSafety } = useApp();
  const ex = d.checkins.find(c => c.day === dayKey(Date.now()));
  const [f, setF] = useState(ex ? { mood: ex.mood, intensity: ex.intensity, energy: ex.energy, sleep: ex.sleep, note: ex.note || '' } : { mood: '', intensity: 3, energy: 3, sleep: 7, note: '' });
  const set = k => e => setF({ ...f, [k]: e.target.type === 'range' || e.target.type === 'number' ? +e.target.value : e.target.value });

  async function save(e) {
    e.preventDefault(); if (!f.mood) return toast('Pick how you feel first.');
    const day = dayKey(Date.now()), cur = dRef.current.checkins.find(c => c.day === day);
    const sealed = await Vault.seal(f), ts = cur ? cur.ts : Date.now();                 // encrypted like the journal
    const row = await API.put('checkins', { id: cur ? cur.id : undefined, ts, day, ...sealed });
    commit({ checkins: [...dRef.current.checkins.filter(c => c.id !== row.id), { id: row.id, ts, day, ...f }].sort((a, b) => a.ts - b.ts) });
    await refreshShares(); toast('Check-in saved and encrypted.');
    if (f.note && Emotion.analyse(f.note).support) setSafety(true);
  }
  const list = [...d.checkins].reverse().slice(0, 14);

  return <div className="grid2">
    <form className="glass card" data-form="checkin" onSubmit={save}>
      <h2>{ex ? 'Update today\'s check-in' : 'How are you feeling today?'}</h2>
      <div className="picker">{Emotion.KEYS.map(k => <label key={k} className={'pk' + (f.mood === k ? ' on' : '')} style={{ '--c': EMO[k].color }}>
        <input type="radio" name="mood" value={k} checked={f.mood === k} onChange={set('mood')} />{EMO[k].emoji} {EMO[k].label}</label>)}</div>
      <label>How strong is the feeling? <output>{f.intensity}</output>/5</label><input type="range" min="1" max="5" value={f.intensity} onChange={set('intensity')} />
      <div className="grid2 tight">
        <div><label>Energy <output>{f.energy}</output>/5</label><input type="range" min="1" max="5" value={f.energy} onChange={set('energy')} /></div>
        <div><label>Hours of sleep</label><input type="number" min="0" max="16" step="0.5" value={f.sleep} onChange={set('sleep')} /></div>
      </div>
      <label>Anything else? (optional, encrypted)</label><textarea rows="3" maxLength={500} value={f.note} onChange={set('note')} />
      <button className="btn primary" style={{ marginTop: 14 }}>Save check-in</button>
    </form>
    <div className="glass card">
      <div className="row between"><h2>Recent check-ins</h2><span className="pill">🔥 {plural(streak(d.checkins), 'day')}</span></div>
      {list.length ? <div className="ci-grid">{list.map(c => <div className="ci" key={c.id} style={{ '--c': EMO[c.mood].color }}>
        <span>{EMO[c.mood].emoji}</span><b>{EMO[c.mood].label}</b><small>{fmtDay(c.ts)}</small><small>⚡{c.energy} · 😴{c.sleep}h</small></div>)}</div>
        : <p className="empty">Your check-ins will appear here.</p>}
    </div>
  </div>;
}
