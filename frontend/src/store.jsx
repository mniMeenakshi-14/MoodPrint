// App-wide state: signed-in user, decrypted data, navigation, settings, toasts.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import API from './lib/api.js';
import Vault from './lib/vault.js';
import Emotion from './lib/emotion.js';
import { buildSnapshot, moodOf } from './lib/data.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

async function loadData(user) {
  const d = {};
  if (user.role === 'student') {
    d.entries = []; d.checkins = [];
    for (const r of await API.list('entries')) {
      try { const x = await Vault.open(r); d.entries.push({ id: r.id, ts: r.ts, iv: r.iv, ct: r.ct, text: x.text, emo: x.emo || Emotion.analyse(x.text), userEmotion: x.userEmotion || null, edited: x.edited || null }); } catch (e) { /* not readable */ }
    }
    for (const r of await API.list('checkins')) { try { d.checkins.push({ id: r.id, ts: r.ts, day: r.day, ...(await Vault.open(r)) }); } catch (e) { /* skip */ } }
    d.entries.sort((a, b) => a.ts - b.ts); d.checkins.sort((a, b) => a.ts - b.ts);
    d.counsellors = await API.users('counsellor');
  } else {
    [d.followups, d.students] = await Promise.all([API.list('followups'), API.users('student')]);
  }
  [d.requests, d.messages, d.appointments, d.shares] = await Promise.all(['requests', 'messages', 'appointments', 'shares'].map(c => API.list(c)));
  return d;
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [d, setD] = useState({});
  const dRef = useRef({});
  const [page, setPage] = useState(null);
  const [settings, setSettings] = useState({ autoLock: 10, blur: true });
  const [ui, setUiState] = useState({});
  const [toastMsg, setToastMsg] = useState(null);
  const [safety, setSafety] = useState(false);
  const [lockNote, setLockNote] = useState('');

  // always work on the latest data (avoids stale closures between awaits)
  const commit = useCallback(patch => { dRef.current = { ...dRef.current, ...patch }; setD(dRef.current); }, []);
  const setUi = useCallback(patch => setUiState(u => ({ ...u, ...patch })), []);
  const toast = useCallback(m => setToastMsg({ m, k: Date.now() }), []);
  const go = useCallback(p => { setPage(p); window.scrollTo(0, 0); }, []);

  const enter = useCallback(async () => {
    const u = API.user;
    let s = {}; try { s = JSON.parse(localStorage.getItem('mp-settings-' + u.id) || '{}'); } catch (e) { /* none */ }
    setSettings({ autoLock: 10, blur: true, ...s });
    dRef.current = await loadData(u); setD(dRef.current); setUiState({});
    setUser(u); setPage(u.role === 'student' ? 'overview' : 'c-dash');
  }, []);
  const lock = useCallback(note => {
    Vault.lock(); API.logout(); dRef.current = {}; setD({}); setUiState({}); setUser(null); setPage(null); setLockNote(note || 'Vault locked.');
  }, []);
  const saveSettings = useCallback(patch => setSettings(s => { const n = { ...s, ...patch }; try { localStorage.setItem('mp-settings-' + API.user.id, JSON.stringify(n)); } catch (e) { /* ignore */ } return n; }), []);

  // keep any active consent summary in sync with the student's data
  const refreshShares = useCallback(async () => {
    const cur = dRef.current, shares = [...(cur.shares || [])];
    for (let i = 0; i < shares.length; i++) {
      if (!shares[i].active) continue;
      const snapshot = buildSnapshot(cur, shares[i].scope);
      await API.patch('shares', shares[i].id, { snapshot }); shares[i] = { ...shares[i], snapshot };
    }
    commit({ shares });
  }, [commit]);

  // analyse -> encrypt -> store ciphertext
  const saveEntry = useCallback(async (text, pick, id) => {
    const cur = dRef.current, old = id && cur.entries.find(e => e.id === id);
    const emo = Emotion.analyse(text);
    const data = { text, emo, userEmotion: pick && pick !== emo.primary ? pick : null, edited: old ? Date.now() : null };
    const ts = old ? old.ts : Date.now(), sealed = await Vault.seal(data);
    const row = await API.put('entries', { id: id || undefined, ts, ...sealed });
    const e = { id: row.id, ts, iv: sealed.iv, ct: sealed.ct, ...data };
    commit({ entries: [...cur.entries.filter(x => x.id !== e.id), e].sort((a, b) => a.ts - b.ts) });
    await refreshShares();
    return e;
  }, [commit, refreshShares]);

  const correctEntry = useCallback(async (id, emotion) => {
    const e = dRef.current.entries.find(x => x.id === id);
    const userEmotion = emotion === e.emo.primary ? null : emotion;
    const sealed = await Vault.seal({ text: e.text, emo: e.emo, userEmotion, edited: e.edited });   // re-encrypt
    await API.put('entries', { id, ts: e.ts, ...sealed });
    commit({ entries: dRef.current.entries.map(x => x.id === id ? { ...x, ...sealed, userEmotion } : x) });
    await refreshShares();
    return userEmotion;
  }, [commit, refreshShares]);

  // pick up changes made by other accounts (messages, accepted requests, consent)
  const sync = useCallback(async () => {
    if (!API.user) return;
    const cols = ['requests', 'messages', 'appointments', 'shares'].concat(API.user.role === 'counsellor' ? ['followups'] : []);
    try {
      const got = await Promise.all(cols.map(c => API.list(c)));
      const patch = {}; cols.forEach((c, i) => { if (JSON.stringify(got[i]) !== JSON.stringify(dRef.current[c])) patch[c] = got[i]; });
      if (Object.keys(patch).length) commit(patch);
    } catch (e) { /* offline */ }
  }, [commit]);
  useEffect(() => { if (user) sync(); }, [page, user, sync]);
  useEffect(() => { const t = setInterval(() => { if (API.user && document.visibilityState === 'visible') sync(); }, 15000); return () => clearInterval(t); }, [sync]);

  // auto-lock after inactivity
  useEffect(() => {
    if (!user) return;
    let t; const bump = () => { clearTimeout(t); t = setTimeout(() => lock('Locked after ' + settings.autoLock + ' minutes of inactivity.'), settings.autoLock * 6e4); };
    bump(); ['click', 'keydown'].forEach(ev => document.addEventListener(ev, bump));
    return () => { clearTimeout(t); ['click', 'keydown'].forEach(ev => document.removeEventListener(ev, bump)); };
  }, [user, settings.autoLock, lock]);

  const value = { user, setUser, d, dRef, commit, page, go, settings, saveSettings, ui, setUi, toast, toastMsg, safety, setSafety, lock, lockNote, setLockNote, enter, refreshShares, saveEntry, correctEntry, moodOf };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
