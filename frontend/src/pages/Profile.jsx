import { useState } from 'react';
import { useApp } from '../store.jsx';
import API from '../lib/api.js';

export default function Profile() {
  const { user, setUser, settings, saveSettings, toast, lock } = useApp();
  const pr = user.profile || {};
  const [f, setF] = useState({ name: user.name, course: pr.course || '', title: pr.title || '', pronouns: pr.pronouns || '' });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    const profile = { ...pr, pronouns: f.pronouns.trim(), ...(user.role === 'student' ? { course: f.course.trim() } : { title: f.title.trim() }) };
    setUser(await API.updateMe(f.name.trim(), profile)); toast('Profile saved.');
  }
  return <div className="grid2">
    <form className="glass card" onSubmit={save}>
      <h2>Your profile</h2>
      <label>Name</label><input value={f.name} onChange={set('name')} maxLength={60} required />
      <label>Username</label><input value={user.username} disabled />
      {user.role === 'student'
        ? <><label>Course / year</label><input value={f.course} onChange={set('course')} placeholder="e.g. B.E. CSE, 3rd year" maxLength={60} /></>
        : <><label>Title</label><input value={f.title} onChange={set('title')} placeholder="e.g. Campus counsellor" maxLength={60} /></>}
      <label>Pronouns (optional)</label><input value={f.pronouns} onChange={set('pronouns')} maxLength={20} />
      <button className="btn primary" style={{ marginTop: 16 }}>Save profile</button>
    </form>
    <div className="glass card"><h2>Session</h2>
      <label>Auto-lock after inactivity</label>
      <select value={settings.autoLock} onChange={e => { saveSettings({ autoLock: +e.target.value }); toast('Auto-lock set to ' + e.target.value + ' minutes.'); }}>{[5, 10, 30].map(m => <option key={m} value={m}>{m} minutes</option>)}</select>
      <p className="small muted" style={{ marginTop: 14 }}>Signed in as <b>{user.username}</b> ({user.role}). Data mode: {API.mode === 'http' ? 'MoodPrint server' : 'this browser only (demo)'}.</p>
      <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => lock()}>🔒 Lock now</button>
    </div>
  </div>;
}
