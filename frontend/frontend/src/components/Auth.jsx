// Sign in / create account / demo campus
import { useEffect, useState } from 'react';
import API from '../lib/api.js';
import Vault from '../lib/vault.js';
import { DEMO, seedDemo } from '../lib/demo.js';
import { useApp } from '../store.jsx';

function strength(p) {
  return Math.min(Math.min(p.length / 16, 1) * 60 + (/[A-Z]/.test(p) ? 10 : 0) + (/\d/.test(p) ? 10 : 0) + (/[^A-Za-z0-9]/.test(p) ? 10 : 0) + (/\s/.test(p) ? 10 : 0), 100);
}

const DEVICE_KEY = 'mp-device-has-account';
const deviceHasAccount = () => { try { return localStorage.getItem(DEVICE_KEY) === '1'; } catch (e) { return false; } };

export default function Auth() {
  const locked = false;   // Create account is always available
  const { enter, lockNote, toast } = useApp();
  const [mode, setMode] = useState('in');
  const [role, setRole] = useState('student');
  const [f, setF] = useState({ name: '', user: '', pass: '', pass2: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(lockNote || (Vault.supported() ? '' : 'This browser blocks the Web Crypto API here. Open MoodPrint over https or localhost.'));
  const [demo, setDemo] = useState({ ready: false, note: 'Creates 3 student accounts with sample data.', busy: false });
  const set = k => e => setF({ ...f, [k]: e.target.value });

  useEffect(() => { API.lookup('diya').then(a => { if (a) setDemo(d => ({ ...d, ready: true })); }); }, []);

  async function submit(e, override) {
    e && e.preventDefault();
    const u = (override ? override.user : f.user).trim().toLowerCase(), p = override ? override.pass : f.pass, m = override ? 'in' : mode;
    if (p.length < 8) return setStatus('Use a passphrase of at least 8 characters.');
    if (m === 'up' && p !== f.pass2) return setStatus('The passphrases don\'t match.');
    setBusy(true);
    try {
      if (m === 'up') {
        setStatus('Generating your vault key on this device…');
        const salt = Vault.newSalt(), verifier = await Vault.unlock(p, salt, Vault.ITER);
        await API.register({ role, username: u, name: f.name.trim() || u, salt, iterations: Vault.ITER, login_verifier: verifier });
        try { localStorage.setItem(DEVICE_KEY, '1'); } catch (e2) { /* ignore */ }
      } else {
        const acct = await API.lookup(u);
        if (!acct) throw new Error('No account with that username.');
        setStatus('Generating your vault key on this device…');
        const verifier = await Vault.unlock(p, acct.salt, acct.iterations);
        if (!await API.login(acct.id, verifier)) { Vault.lock(); throw new Error('That passphrase doesn\'t open this vault.'); }
      }
      setStatus('✓ Vault key ready. Opening MoodPrint…');
      await enter();
    } catch (err) { Vault.lock(); setStatus(err.message); setBusy(false); }
  }

  async function setupDemo() {
    setDemo(d => ({ ...d, busy: true }));
    try { const made = await seedDemo(note => setDemo(d => ({ ...d, note }))); setDemo({ ready: true, busy: false }); toast(made ? 'Demo campus ready. Pick an account.' : 'Demo campus already set up.'); }
    catch (e) { setDemo({ ready: false, busy: false, note: 'Couldn\'t set up the demo: ' + e.message }); }
  }
  const s = strength(f.pass), demoUsers = [...DEMO.students.map(x => [x.username, x.name, '🎓', DEMO.pass])];

  return (
    <section id="auth">
      <div className="auth-intro">
        <div className="logo"><span className="dot" />MoodPrint</div>
        <h1>Understand how you feel.<br /><span className="grad">Keep it yours.</span></h1>
        <ul className="ticks">
          <li>Private journal, encrypted on your device before it's stored</li>
          <li>Emotion analysis that explains itself, and that you can correct</li>
          <li>Reach a counsellor when you want, sharing only what you choose</li>
        </ul>
        <p className="small muted">MoodPrint supports wellbeing. It does not diagnose mental health conditions.</p>
      </div>
      <div className="glass auth-card">
        {locked ? <h2 style={{ marginBottom: 4 }}>Sign in</h2> : <div className="seg" role="tablist">
          <button type="button" className={mode === 'in' ? 'on' : ''} onClick={() => { setMode('in'); setStatus(''); }}>Sign in</button>
          <button type="button" className={mode === 'up' ? 'on' : ''} onClick={() => { setMode('up'); setStatus(''); }}>Create account</button>
        </div>}
        <form onSubmit={submit} autoComplete="off">
          {mode === 'up' && <>
            <label htmlFor="aName">Your name</label><input id="aName" value={f.name} onChange={set('name')} maxLength={60} />
          </>}
          <label htmlFor="aUser">Username</label><input id="aUser" value={f.user} onChange={set('user')} autoCapitalize="none" spellCheck="false" placeholder="e.g. diya" required autoComplete="off" />
          <label htmlFor="aPass">Passphrase</label><input id="aPass" type={show ? 'text' : 'password'} value={f.pass} onChange={set('pass')} required minLength={8} autoComplete="new-password" />
          {mode === 'up' && <>
            <div className="meter"><i style={{ width: s + '%', background: s < 45 ? '#fb7185' : s < 75 ? '#ffd166' : '#34d399' }} /></div>
            <label htmlFor="aPass2">Confirm passphrase</label><input id="aPass2" type={show ? 'text' : 'password'} value={f.pass2} onChange={set('pass2')} />
          </>}
          <label className="check"><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /><span>Show passphrase</span></label>
          <button className="btn primary wide" id="authBtn" disabled={busy}>{mode === 'up' ? 'Create my vault' : 'Unlock'}</button>
          <div className="status" id="authStatus" role="status">{status}</div>
        </form>
        <div className="demo">
          <div className="row between"><b>Demo campus</b>{!demo.ready && <button type="button" className="btn ghost sm" id="seedBtn" disabled={demo.busy} onClick={setupDemo}>Set up demo</button>}</div>
          {demo.ready
            ? <><p className="small muted">Student passphrase: <code>student-demo</code></p>
              <div className="demo-users" id="demoUsers">{demoUsers.map(([u, n, i, p]) => <button key={u} type="button" className="btn ghost sm" data-u={u} disabled={busy} onClick={() => { setF({ ...f, user: u, pass: p }); setMode('in'); submit(null, { user: u, pass: p }); }}>{i} {n}</button>)}</div></>
            : <p className="small muted">{demo.note}</p>}
        </div>
      </div>
    </section>
  );
}
