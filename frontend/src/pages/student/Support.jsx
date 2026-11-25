import { useState } from 'react';
import { useApp } from '../../store.jsx';
import { Status, Snapshot } from '../../components/ui.jsx';
import API from '../../lib/api.js';
import Emotion from '../../lib/emotion.js';
import { buildSnapshot, SCOPE, URG, TOPICS } from '../../lib/data.js';
import { ago, dayKey, fmtDateTime, fmtDay, plural } from '../../lib/util.js';

// shared consent helpers (also used by the Privacy vault page)
export function useConsent() {
  const { user, dRef, commit } = useApp();
  const mine = () => (dRef.current.shares || [])[0] || null;
  async function revoke() {
    const sh = mine(); if (!sh) return;
    commit({ shares: [await API.patch('shares', sh.id, { active: false, snapshot: null, revoked: Date.now() })] });
  }
  async function share(scope) {
    const sh = mine();
    if (!Object.values(scope).some(Boolean)) { if (sh && sh.active) await revoke(); return; }
    const row = await API.put('shares', { id: sh ? sh.id : undefined, studentName: user.name, active: true, scope, snapshot: buildSnapshot(dRef.current, scope), granted: sh && sh.active ? sh.granted : Date.now(), revoked: null });
    commit({ shares: [row] });
  }
  return { mine, share, revoke };
}

function ScopeBoxes({ scope, setScope }) {
  return Object.entries(SCOPE).map(([k, [t, desc]]) => <label key={k} className="check opt">
    <input type="checkbox" checked={!!scope[k]} onChange={e => setScope({ ...scope, [k]: e.target.checked })} /><span><b>{t}</b><small>{desc}</small></span></label>);
}
function Appts({ list }) {
  return list.length ? [...list].sort((a, b) => a.when.localeCompare(b.when)).map(a => <div className="req" key={a.id}><div>
    <b>{new Date(a.when).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b> <Status s={a.status} />
    <small>{a.mode}{a.note ? ' · ' + a.note : ''}</small></div></div>) : <p className="muted small">No appointments yet. Request one inside a conversation.</p>;
}

function Thread({ r }) {
  const { user, d, dRef, commit, setUi, toast, setSafety } = useApp();
  const [msg, setMsg] = useState('');
  const [ap, setAp] = useState({ date: '', time: '16:00', mode: 'In person', note: '' });
  const M = d.messages.filter(m => m.request === r.id).sort((a, b) => a.ts - b.ts), A = d.appointments.filter(a => a.request === r.id);
  async function send(e) {
    e.preventDefault(); const text = msg.trim(); if (!text) return; const now = Date.now();
    const m = await API.put('messages', { request: r.id, from: 'student', fromName: user.name, text, ts: now });
    const nr = await API.patch('requests', r.id, { updated: now });
    commit({ messages: [...dRef.current.messages, m], requests: dRef.current.requests.map(x => x.id === r.id ? nr : x) }); setMsg('');
    if (Emotion.analyse(text).support) setSafety(true);
  }
  async function book(e) {
    e.preventDefault();
    const a = await API.put('appointments', { request: r.id, studentName: user.name, when: new Date(ap.date + 'T' + ap.time).toISOString(), mode: ap.mode, note: ap.note.trim(), status: 'requested', created: Date.now() });
    commit({ appointments: [...dRef.current.appointments, a] }); toast('Appointment requested.');
  }
  return <>
    <button className="btn ghost sm" onClick={() => setUi({ thread: null })}>← All requests</button>
    <div className="grid2" style={{ marginTop: 14 }}>
      <div className="glass card chat">
        <div className="row between"><h2>{r.topic}</h2><Status s={r.status} /></div>
        <p className="small muted">{r.counsellorName ? 'Talking with ' + r.counsellorName : 'A counsellor will pick this up soon.'} · {URG[r.urgency]}</p>
        <div className="msgs">{M.map(m => <div key={m.id} className={'msg' + (m.from === 'student' ? ' me' : '')}><p>{m.text}</p><small>{m.from === 'student' ? 'You' : m.fromName} · {fmtDateTime(m.ts)}</small></div>)}</div>
        {r.status === 'closed' || r.status === 'declined' ? <p className="muted small">This conversation is closed.</p>
          : <form className="reply" data-form="sMsg" onSubmit={send}><input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Write a message…" required maxLength={1000} /><button className="btn primary">Send</button></form>}
      </div>
      <div className="glass card">
        <h3>Request an appointment</h3>
        <form onSubmit={book}>
          <div className="grid2 tight"><div><label>Date</label><input type="date" required min={dayKey(Date.now())} value={ap.date} onChange={e => setAp({ ...ap, date: e.target.value })} /></div>
            <div><label>Time</label><input type="time" required value={ap.time} onChange={e => setAp({ ...ap, time: e.target.value })} /></div></div>
          <label>Where</label><select value={ap.mode} onChange={e => setAp({ ...ap, mode: e.target.value })}><option>In person</option><option>Online call</option></select>
          <label>Note (optional)</label><input maxLength={140} value={ap.note} onChange={e => setAp({ ...ap, note: e.target.value })} />
          <button className="btn primary" style={{ marginTop: 12 }}>Request appointment</button>
        </form>
        <h3 style={{ marginTop: 20 }}>Appointments</h3><Appts list={A} />
      </div>
    </div>
  </>;
}

export default function Support() {
  const { user, d, dRef, commit, ui, setUi, toast } = useApp();
  const { mine, share, revoke } = useConsent();
  const sh = (d.shares || [])[0] || null;
  const [scope, setScope] = useState(sh && sh.active ? sh.scope : { summary: true, trend: true });
  const [req, setReq] = useState({ topic: TOPICS[0], message: '', urgency: ui.reqUrgency || 'low' });
  const th = ui.thread && d.requests.find(r => r.id === ui.thread);
  if (th) return <Thread r={th} />;
  const R = [...d.requests].sort((a, b) => b.updated - a.updated);

  async function send(e) {
    e.preventDefault(); const now = Date.now();
    const r = await API.put('requests', { studentName: user.name, topic: req.topic, urgency: req.urgency, status: 'pending', counsellor: null, counsellorName: null, created: now, updated: now });
    const m = await API.put('messages', { request: r.id, from: 'student', fromName: user.name, text: req.message.trim(), ts: now });
    commit({ requests: [...dRef.current.requests, r], messages: [...dRef.current.messages, m] });
    if (!(mine() && mine().active)) await share(scope);
    toast('Request sent. A counsellor will respond soon.'); setUi({ thread: r.id, reqUrgency: null });
  }
  return <>
    <div className="note glass">🔐 Counsellors can <b>never</b> read your journal or check-ins. They only see your messages, and the summary below while you allow it.</div>
    <div className="grid2" style={{ marginTop: 16 }}>
      <div className="glass card">
        <h2>Your support requests</h2>
        {R.length ? R.map(r => { const n = d.messages.filter(m => m.request === r.id).length;
          return <div className="req" key={r.id}><div><b>{r.topic}</b> <Status s={r.status} /><small>{r.counsellorName ? 'With ' + r.counsellorName + ' · ' : 'Waiting for a counsellor · '}{plural(n, 'message')} · {ago(r.updated)}</small></div>
            <button className="btn ghost sm" data-act="openThread" onClick={() => setUi({ thread: r.id })}>Open</button></div>; }) : <p className="empty">No requests yet.</p>}
        <h3 style={{ marginTop: 20 }}>Request counselling</h3>
        <form onSubmit={send}>
          <label>What would you like to talk about?</label><select value={req.topic} onChange={e => setReq({ ...req, topic: e.target.value })}>{TOPICS.map(t => <option key={t}>{t}</option>)}</select>
          <label>Message to the counsellor</label><textarea rows="3" required maxLength={1000} placeholder="A few words about what's going on" value={req.message} onChange={e => setReq({ ...req, message: e.target.value })} />
          <label>How urgent is it?</label>
          <div className="seg wrap">{Object.entries(URG).map(([k, t]) => <label key={k} className="radio"><input type="radio" name="urgency" checked={req.urgency === k} onChange={() => setReq({ ...req, urgency: k })} /><span>{t}</span></label>)}</div>
          {sh && sh.active ? <p className="small muted" style={{ marginTop: 12 }}>Your current sharing settings apply (see “What counsellors can see”).</p>
            : <><p className="small muted" style={{ marginTop: 12 }}>Share with your request (you can change this any time):</p><ScopeBoxes scope={scope} setScope={setScope} /></>}
          <button className="btn primary" style={{ marginTop: 12 }}>Send request</button>
        </form>
      </div>
      <div>
        <div className="glass card">
          <h2>What counsellors can see</h2>
          <p className="small">{sh && sh.active ? '✅ Sharing since ' + fmtDay(sh.granted) : sh && sh.revoked ? '⛔ Access revoked on ' + fmtDay(sh.revoked) : 'Nothing shared yet.'}</p>
          <ScopeBoxes scope={scope} setScope={setScope} />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary sm" onClick={async () => { await share(scope); toast(Object.values(scope).some(Boolean) ? 'Sharing updated.' : 'Nothing selected, so access is revoked.'); }}>{sh && sh.active ? 'Update sharing' : 'Start sharing'}</button>
            {sh && sh.active && <button className="btn ghost sm danger" data-act="revoke" onClick={async () => { await revoke(); toast('Access revoked. Counsellors can no longer see your summary.'); }}>Revoke access</button>}
          </div>
          {sh && sh.active && sh.snapshot && <details style={{ marginTop: 12 }}><summary className="small">Preview exactly what they see</summary><Snapshot s={sh.snapshot} /></details>}
        </div>
        <div className="glass card" style={{ marginTop: 18 }}><h3>Appointments</h3><Appts list={d.appointments} /></div>
      </div>
    </div>
  </>;
}
