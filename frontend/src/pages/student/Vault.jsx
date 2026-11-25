import { useApp } from '../../store.jsx';
import { ConfirmBtn } from '../../components/ui.jsx';
import API from '../../lib/api.js';
import { SCOPE } from '../../lib/data.js';
import { plural } from '../../lib/util.js';
import { useConsent } from './Support.jsx';

export default function VaultPage() {
  const { d, dRef, commit, settings, saveSettings, lock, go, toast, refreshShares } = useApp();
  const { revoke } = useConsent();
  const sh = (d.shares || [])[0] || null;
  async function wipe() {
    for (const e of dRef.current.entries) await API.remove('entries', e.id);
    for (const c of dRef.current.checkins) await API.remove('checkins', c.id);
    commit({ entries: [], checkins: [] }); await refreshShares(); toast('All journal data deleted.');
  }
  return <div className="grid2">
    <div className="glass card">
      <div className="row between"><h2>Vault status</h2><span className="pill on">🔓 Unlocked</span></div>
      <p>Your vault key was generated on this device from your passphrase and exists only in memory while you're signed in.</p>
      <button className="btn primary" onClick={() => lock()}>🔒 Lock vault now</button>
      <h3 style={{ marginTop: 22 }}>How your data is protected</h3>
      <ul className="ticks small">
        <li>Passphrase → PBKDF2-SHA-256 (310,000 rounds) → vault key + separate login key</li>
        <li>Journal entries, emotion results and check-ins are sealed with AES-256-GCM before they're stored</li>
        <li>The server keeps only ciphertext; it never receives your passphrase or vault key</li>
        <li>Counsellors can't read journals, even as ciphertext; they see only what you share</li>
        <li>Forgotten passphrase = no recovery. Not even the server can decrypt your vault</li>
      </ul>
      <p className="small muted">{plural(d.entries.length, 'journal entry')} · {plural(d.checkins.length, 'check-in')} stored encrypted</p>
    </div>
    <div>
      <div className="glass card"><h2>Privacy settings</h2>
        <label className="check opt"><input type="checkbox" checked={settings.blur} onChange={e => { saveSettings({ blur: e.target.checked }); toast(e.target.checked ? 'Entries stay encrypted on screen.' : 'Entries are shown decrypted.'); }} />
          <span><b>Keep entries encrypted on screen</b><small>Show ciphertext in the journal list until you tap Decrypt</small></span></label>
        <label>Auto-lock after inactivity</label>
        <select value={settings.autoLock} onChange={e => { saveSettings({ autoLock: +e.target.value }); toast('Auto-lock set to ' + e.target.value + ' minutes.'); }}>{[5, 10, 30].map(m => <option key={m} value={m}>{m} minutes</option>)}</select>
      </div>
      <div className="glass card" style={{ marginTop: 18 }}><h2>Consent management</h2>
        <p>{sh && sh.active ? <>✅ Counsellors can see: <b>{Object.entries(sh.scope).filter(([, v]) => v).map(([k]) => SCOPE[k][0]).join(', ')}</b></> : '⛔ Counsellors can\'t see any of your mood data.'}</p>
        <div className="row"><button className="btn ghost sm" onClick={() => go('support')}>Manage sharing</button>{sh && sh.active && <button className="btn ghost sm danger" onClick={async () => { await revoke(); toast('All counsellor access revoked.'); }}>Revoke all access</button>}</div>
      </div>
      <div className="glass card" style={{ marginTop: 18 }}><h2>Delete my data</h2>
        <p className="small muted">Permanently deletes all journal entries and check-ins. This can't be undone.</p>
        <ConfirmBtn className="btn ghost sm" confirmText="Tap again to delete everything" onConfirm={wipe}>Delete all journal data</ConfirmBtn>
      </div>
    </div>
  </div>;
}
