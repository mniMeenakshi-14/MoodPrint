import { useState } from 'react';
import { Avatar, Donut, Priority, Snapshot, Spark, Status, ConfirmBtn } from '../../components/ui.jsx';
import API from '../../lib/api.js';
import { SCOPE, URG } from '../../lib/data.js';
import { ago, avg, dayKey, fmtDateTime, plural, DAY } from '../../lib/util.js';
import { useC, ReqCard, ConsentTag, prRank, whenStr } from './common.jsx';

const dirCls = x => x === 'heavier' ? 'down' : x === 'improving' ? 'up' : '';

/* ================= DASHBOARD ================= */
export function Dashboard() {
  const { d, prOf, accept, toggleFu, setUi, go } = useC();
  const O = d.requests.filter(r => r.status === 'pending' || r.status === 'active').sort((a, b) => prRank[prOf(b)] - prRank[prOf(a)] || b.updated - a.updated), today = dayKey(Date.now());
  const due = d.followups.filter(f => !f.done && f.due <= today);
  const heavy = d.shares.filter(s => s.snapshot && s.snapshot.trend && s.snapshot.trend.direction === 'heavier');
  return <>
    <div className="kpis">
      <div className="glass kpi"><b>{d.requests.filter(r => r.status === 'pending').length}</b><span>pending requests</span></div>
      <div className="glass kpi"><b>{d.requests.filter(r => r.status === 'active').length}</b><span>active conversations</span></div>
      <div className="glass kpi"><b>{O.filter(r => prOf(r) === 'High').length}</b><span>high priority</span></div>
      <div className="glass kpi"><b>{due.length}</b><span>follow-ups due</span></div>
    </div>
    <div className="grid2" style={{ marginTop: 18 }}>
      <div><h3 className="sect">Needs attention</h3>
        {O.length ? O.slice(0, 5).map(r => <ReqCard key={r.id} r={r}>{r.status === 'pending'
          ? <button className="btn primary sm" data-act="cAccept" onClick={() => accept(r)}>Accept</button>
          : <button className="btn ghost sm" onClick={() => { setUi({ thread: r.id }); go('c-messages'); }}>Open conversation</button>}</ReqCard>)
          : <div className="glass card"><p className="empty">No open requests. 🎉</p></div>}</div>
      <div>
        <div className="glass card"><h3>Follow-ups due</h3>
          {due.length ? due.map(f => <div className="req" key={f.id}><div><b>{f.studentName}</b><small>{f.note} · due {f.due}</small></div><button className="btn ghost xs" onClick={() => toggleFu(f)}>Done</button></div>) : <p className="muted small">Nothing due today.</p>}</div>
        <div className="glass card" style={{ marginTop: 18 }}><h3>Shared trends to watch</h3>
          {heavy.length ? heavy.map(s => <div className="req" key={s.id}><div><b>{s.studentName}</b><small className="down">Mood trend: heavier</small></div><button className="btn ghost xs" onClick={() => { setUi({ stu: s.student }); go('c-students'); }}>View</button></div>) : <p className="muted small">No shared trends are getting heavier.</p>}</div>
      </div>
    </div>
  </>;
}

/* ================= REQUESTS ================= */
export function Requests() {
  const { d, prOf, accept, setReq, toast, ui, setUi, go } = useC();
  const f = ui.rf || 'pending', match = (r, s) => s === 'closed' ? (r.status === 'closed' || r.status === 'declined') : r.status === s;
  const L = d.requests.filter(r => match(r, f)).sort((a, b) => prRank[prOf(b)] - prRank[prOf(a)] || b.created - a.created);
  const open = r => { setUi({ thread: r.id }); go('c-messages'); };
  return <>
    <div className="seg">{['pending', 'active', 'closed'].map(s => <button key={s} className={f === s ? 'on' : ''} onClick={() => setUi({ rf: s })}>{s[0].toUpperCase() + s.slice(1)} ({d.requests.filter(r => match(r, s)).length})</button>)}</div>
    <p className="small muted" style={{ margin: '12px 0' }}>Priority combines how urgent the student said it is with any wellbeing alerts they chose to share.</p>
    {L.length ? L.map(r => <ReqCard key={r.id} r={r}>
      {r.status === 'pending' && <><button className="btn primary sm" data-act="cAccept" onClick={() => accept(r)}>Accept</button><button className="btn ghost sm" onClick={async () => { await setReq(r.id, { status: 'declined' }); toast('Request declined.'); }}>Decline</button></>}
      {r.status === 'active' && <><button className="btn ghost sm" onClick={() => open(r)}>Open conversation</button><button className="btn ghost sm" onClick={async () => { await setReq(r.id, { status: 'closed' }); toast('Conversation closed.'); }}>Close</button></>}
      {(r.status === 'closed' || r.status === 'declined') && <button className="btn ghost sm" onClick={() => open(r)}>View</button>}
    </ReqCard>) : <div className="glass card"><p className="empty">Nothing here.</p></div>}
  </>;
}

/* ================= STUDENTS ================= */
export function Students() {
  const { d, shareOf, stuName, prOf, toggleFu, ui, setUi, go } = useC();
  const ids = [...new Set([...d.requests.map(r => r.student), ...d.shares.map(s => s.student)])];
  if (!ids.length) return <div className="glass card"><p className="empty">No students have reached out or shared data yet.</p></div>;
  const sel = ui.stu && ids.includes(ui.stu) ? ui.stu : ids[0];
  const sh = shareOf(sel), R = d.requests.filter(r => r.student === sel), F = d.followups.filter(f => f.student === sel && !f.done), st = d.students.find(s => s.id === sel) || { profile: {} };
  return <div className="grid-side">
    <div className="glass card list">{ids.map(id => { const rs = d.requests.filter(r => r.student === id && (r.status === 'pending' || r.status === 'active')), p = rs.length ? rs.map(prOf).sort((a, b) => prRank[b] - prRank[a])[0] : null;
      return <button key={id} className={'li' + (id === sel ? ' on' : '')} onClick={() => setUi({ stu: id })}><Avatar name={stuName(id)} /><span><b>{stuName(id)}</b><small>{shareOf(id) ? '🤝 sharing' : '🔒 not sharing'}{rs.length ? ' · ' + plural(rs.length, 'open request') : ''}</small></span>{p && <i className={'prdot pr-' + p.toLowerCase()} />}</button>; })}</div>
    <div>
      <div className="glass card">
        <div className="row between wrap"><div className="row"><Avatar name={stuName(sel)} lg /><div><h2>{stuName(sel)}</h2><small className="muted">{st.profile.course || 'Student'}{st.profile.pronouns ? ' · ' + st.profile.pronouns : ''}</small></div></div><ConsentTag on={!!sh} /></div>
        <div className="lockline">📓 Journal and check-ins: <b>private to the student</b>. Counsellors can't access them.</div>
        {sh ? <><h3>Shared mood summary</h3><p className="small muted">Student is sharing: {Object.entries(sh.scope).filter(([, v]) => v).map(([k]) => SCOPE[k][0]).join(', ')}</p><Snapshot s={sh.snapshot} /></>
          : <p className="muted">This student hasn't shared any mood data, or has revoked access.</p>}
      </div>
      <div className="grid2" style={{ marginTop: 18 }}>
        <div className="glass card"><h3>Requests</h3>{R.length ? R.map(r => <div className="req" key={r.id}><div><b>{r.topic}</b> <Status s={r.status} /> <Priority p={prOf(r)} /><small>{ago(r.created)}</small></div><button className="btn ghost xs" onClick={() => { setUi({ thread: r.id }); go('c-messages'); }}>Open</button></div>) : <p className="muted small">None.</p>}</div>
        <div className="glass card"><h3>Follow-ups</h3>{F.length ? F.map(f => <div className="req" key={f.id}><div><b>{f.due}</b><small>{f.note}</small></div><button className="btn ghost xs" onClick={() => toggleFu(f)}>Done</button></div>) : <p className="muted small">None planned.</p>}
          <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => { setUi({ fuFor: sel }); go('c-followups'); }}>+ Plan follow-up</button></div>
      </div>
    </div>
  </div>;
}

/* ================= SHARED ANALYTICS ================= */
export function Analytics() {
  const { d, setUi, go } = useC();
  const Sh = d.shares.filter(s => s.snapshot), withSum = Sh.filter(s => s.snapshot.emotions), withTr = Sh.filter(s => s.snapshot.trend);
  if (!Sh.length) return <div className="glass card"><p className="empty">No students are sharing mood data right now.</p></div>;
  const c = {}; withSum.forEach(s => s.snapshot.emotions.forEach(e => { c[e.key] = (c[e.key] || 0) + e.count; }));
  const dir = { improving: 0, steady: 0, heavier: 0 }; withTr.forEach(s => { if (dir[s.snapshot.trend.direction] !== undefined) dir[s.snapshot.trend.direction]++; });
  return <>
    <div className="kpis">
      <div className="glass kpi"><b>{Sh.length}</b><span>students sharing</span></div>
      <div className="glass kpi"><b>{withSum.length ? Math.round(avg(withSum.map(s => s.snapshot.avg_intensity))) + '/100' : '–'}</b><span>average intensity</span></div>
      <div className="glass kpi"><b>{withSum.length ? Math.round(avg(withSum.map(s => s.snapshot.negative_pct))) + '%' : '–'}</b><span>heavier moods</span></div>
      <div className="glass kpi"><b className="down">{dir.heavier}</b><span>trending heavier</span></div>
    </div>
    <div className="grid2" style={{ marginTop: 18 }}>
      <div className="glass card"><h3>Emotions across shared summaries</h3><Donut counts={c} /></div>
      <div className="glass card"><h3>Trends by student</h3><p className="small muted">Weekly mood score, last 4 weeks (only students sharing trends)</p>
        {withTr.length ? withTr.map(s => <div className="trendrow" key={s.id}><b>{s.studentName}</b><Spark vals={s.snapshot.trend.weekly} color={s.snapshot.trend.direction === 'heavier' ? '#fb7185' : s.snapshot.trend.direction === 'improving' ? '#34d399' : '#7dd3fc'} />
          <span className={dirCls(s.snapshot.trend.direction)}>{s.snapshot.trend.direction}</span><button className="btn ghost xs" onClick={() => { setUi({ stu: s.student }); go('c-students'); }}>View</button></div>) : <p className="muted small">No trends shared.</p>}
        <div className="kv" style={{ marginTop: 14 }}><span>Improving</span><b className="up">{dir.improving}</b><span>Steady</span><b>{dir.steady}</b><span>Heavier</span><b className="down">{dir.heavier}</b></div>
      </div>
    </div>
    <p className="small muted" style={{ marginTop: 14 }}>Only aggregated, consented summaries appear here. No journal text is ever shared.</p>
  </>;
}

/* ================= MESSAGES ================= */
export function Messages() {
  const { user, d, dRef, commit, prOf, shareOf, accept, setReq, toast, ui, setUi } = useC();
  const [text, setText] = useState('');
  const R = d.requests.filter(r => r.status !== 'declined').sort((a, b) => b.updated - a.updated);
  if (!R.length) return <div className="glass card"><p className="empty">No conversations yet.</p></div>;
  const r = R.find(x => x.id === ui.thread) || R[0];
  const M = d.messages.filter(m => m.request === r.id).sort((a, b) => a.ts - b.ts), sh = shareOf(r.student);
  async function send(e) {
    e.preventDefault(); const t = text.trim(); if (!t) return;
    const m = await API.put('messages', { request: r.id, student: r.student, from: 'counsellor', fromName: user.name, text: t, ts: Date.now() });
    commit({ messages: [...dRef.current.messages, m] }); await setReq(r.id, {}); setText('');
  }
  return <div className="grid-side">
    <div className="glass card list">{R.map(x => { const last = d.messages.filter(m => m.request === x.id).sort((a, b) => b.ts - a.ts)[0];
      return <button key={x.id} className={'li' + (x.id === r.id ? ' on' : '')} onClick={() => setUi({ thread: x.id })}><Avatar name={x.studentName} /><span><b>{x.studentName}</b><small>{x.topic}{last ? ' · ' + last.text.slice(0, 34) + '…' : ''}</small></span><Status s={x.status} /></button>; })}</div>
    <div className="grid2 msgs-grid">
      <div className="glass card chat">
        <div className="row between"><div><h2>{r.studentName}</h2><small className="muted">{r.topic} · {URG[r.urgency]}</small></div><span className="row"><Priority p={prOf(r)} /><Status s={r.status} /></span></div>
        <div className="msgs">{M.map(m => <div key={m.id} className={'msg' + (m.from === 'counsellor' ? ' me' : '')}><p>{m.text}</p><small>{m.from === 'counsellor' ? 'You' : m.fromName} · {fmtDateTime(m.ts)}</small></div>)}</div>
        {r.status === 'pending' ? <div className="row"><button className="btn primary" onClick={() => accept(r)}>Accept request to reply</button></div>
          : r.status === 'active' ? <><form className="reply" data-form="cMsg" onSubmit={send}><input value={text} onChange={e => setText(e.target.value)} placeholder={'Reply to ' + r.studentName.split(' ')[0] + '…'} required maxLength={1000} /><button className="btn primary">Send</button></form>
            <button className="btn ghost xs" style={{ marginTop: 10 }} onClick={async () => { await setReq(r.id, { status: 'closed' }); toast('Conversation closed.'); }}>Close conversation</button></>
          : <p className="muted small">This conversation is closed.</p>}
      </div>
      <div className="glass card">
        <h3>Shared summary</h3>{sh ? <Snapshot s={sh.snapshot} /> : <p className="muted small">🔒 Not shared by the student.</p>}
      </div>
    </div>
  </div>;
}

/* ================= FOLLOW-UPS ================= */
export function Followups() {
  const { d, dRef, commit, stuName, toggleFu, toast, ui, setUi } = useC();
  const ids = [...new Set([...d.requests.map(r => r.student), ...d.students.map(s => s.id)])];
  const [f, setF] = useState({ student: ui.fuFor || ids[0] || '', due: dayKey(Date.now() + 3 * DAY), note: '' });
  const today = dayKey(Date.now()), F = [...d.followups].sort((a, b) => a.due.localeCompare(b.due));
  async function add(e) {
    e.preventDefault();
    const row = await API.put('followups', { student: f.student, studentName: stuName(f.student), due: f.due, note: f.note.trim(), done: false, created: Date.now() });
    commit({ followups: [...dRef.current.followups, row] }); setF({ ...f, note: '' }); setUi({ fuFor: null }); toast('Follow-up added.');
  }
  async function del(id) { await API.remove('followups', id); commit({ followups: dRef.current.followups.filter(x => x.id !== id) }); }
  const groups = [['Overdue', F.filter(x => !x.done && x.due < today), 'down'], ['Today', F.filter(x => !x.done && x.due === today), ''], ['Upcoming', F.filter(x => !x.done && x.due > today), ''], ['Done', F.filter(x => x.done), 'muted']];
  return <div className="grid2">
    <form className="glass card" onSubmit={add}><h2>Plan a follow-up</h2>
      <label>Student</label><select required value={f.student} onChange={e => setF({ ...f, student: e.target.value })}>{ids.map(id => <option key={id} value={id}>{stuName(id)}</option>)}</select>
      <label>Due date</label><input type="date" required value={f.due} onChange={e => setF({ ...f, due: e.target.value })} />
      <label>Note</label><input required maxLength={140} placeholder="e.g. Check in after exams" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
      <button className="btn primary" style={{ marginTop: 14 }}>Add follow-up</button>
    </form>
    <div className="glass card">{groups.map(([t, L, c]) => <div key={t}><h3 className={c}>{t} ({L.length})</h3>
      {L.length ? L.map(x => <div className="req" key={x.id}><div><b>{x.studentName}</b><small>{x.note} · {x.due}</small></div><span className="row"><button className="btn ghost xs" onClick={() => toggleFu(x)}>{x.done ? 'Undo' : 'Done'}</button><ConfirmBtn onConfirm={() => del(x.id)}>Delete</ConfirmBtn></span></div>) : <p className="muted small">—</p>}</div>)}</div>
  </div>;
}
