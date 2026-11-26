// Counsellor helpers. Counsellors see requests, messages and appointments,
// and a student's mood summary ONLY while that student shares it.
import { useApp } from '../../store.jsx';
import { Avatar, Priority, Status } from '../../components/ui.jsx';
import API from '../../lib/api.js';
import { priorityOf, URG } from '../../lib/data.js';
import { ago } from '../../lib/util.js';

export const prRank = { High: 3, Medium: 2, Low: 1 };
export const whenStr = w => new Date(w).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function useC() {
  const app = useApp(), { d, dRef, commit, user } = app;
  const shareOf = id => (d.shares || []).find(s => s.student === id && s.active) || null;
  const stuName = id => (d.students.find(s => s.id === id) || {}).name || (d.requests.find(r => r.student === id) || {}).studentName || 'Student';
  const prOf = r => priorityOf(r, shareOf(r.student));
  const setReq = async (id, patch) => { const nr = await API.patch('requests', id, { ...patch, updated: Date.now() }); commit({ requests: dRef.current.requests.map(x => x.id === id ? nr : x) }); return nr; };
  const accept = async r => { await setReq(r.id, { status: 'active', counsellor: user.id, counsellorName: user.name }); app.toast('Request accepted. Say hello to ' + r.studentName.split(' ')[0] + '.'); app.setUi({ thread: r.id }); app.go('c-messages'); };
  const setAppt = async (id, status) => { const na = await API.patch('appointments', id, { status }); commit({ appointments: dRef.current.appointments.map(x => x.id === id ? na : x) }); app.toast('Appointment ' + status + '.'); };
  const toggleFu = async f => { const nf = await API.patch('followups', f.id, { done: !f.done }); commit({ followups: dRef.current.followups.map(x => x.id === f.id ? nf : x) }); };
  return { ...app, shareOf, stuName, prOf, setReq, accept, setAppt, toggleFu };
}

export const ConsentTag = ({ on }) => on ? <span className="tagc ok">🤝 Sharing mood summary</span> : <span className="tagc">🔒 No mood data shared</span>;

export function ReqCard({ r, children }) {
  const { d, prOf, shareOf } = useC();
  const first = d.messages.filter(m => m.request === r.id).sort((a, b) => a.ts - b.ts)[0], p = prOf(r);
  return <div className={'glass card req-card pr-edge-' + p.toLowerCase()}>
    <div className="row between"><div className="row"><Avatar name={r.studentName} /><div><b>{r.studentName}</b><small className="muted" style={{ display: 'block' }}>{r.topic} · {ago(r.created)}</small></div></div><span className="row"><Priority p={p} /><Status s={r.status} /></span></div>
    <p className="small"><b>{URG[r.urgency]}</b>{first && <> · “{first.text.slice(0, 160)}{first.text.length > 160 ? '…' : ''}”</>}</p>
    <div className="row between wrap"><ConsentTag on={!!shareOf(r.student)} /><span className="row">{children}</span></div>
  </div>;
}
