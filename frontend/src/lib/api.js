// ============================================================
// FRONTEND <-> BACKEND
// Same API either way:
//   http  - the Python server (app.py) when window.MOODPRINT_API is set
//   local - a simulated server inside this browser (offline / artifact)
// Both apply the same privacy rules: counsellors can never read
// journal entries or check-ins, and only see a mood summary while
// the student's consent is active.
// ============================================================
const API = (() => {
  const BASE = import.meta.env.VITE_API_URL || window.MOODPRINT_API || null;
  const K = 'moodprint-campus-v1';
  const PRIVATE = ['entries', 'checkins'], SHARED = ['requests', 'messages', 'appointments'];
  let token = null, me = null, mem = null;

  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
    del: k => { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const db = () => { const r = ls.get(K); return r ? JSON.parse(r) : (mem || { users: [], docs: {} }); };
  const save = d => { mem = d; ls.set(K, JSON.stringify(d)); };
  const pub = u => ({ id: u.id, role: u.role, username: u.username, name: u.name, profile: u.profile || {} });
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('');

  async function http(method, path, body) {
    const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 204) return null;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || r.statusText); e.status = r.status; throw e; }
    return j;
  }

  // ---- local rules (mirror app.py)
  const canRead = (u, coll, d) => {
    if (u.role === 'student') return d.student === u.id;
    if (PRIVATE.includes(coll)) return false;
    if (coll === 'shares') return !!d.active;
    if (coll === 'followups') return d._owner === u.id;
    return true;
  };
  const canWrite = (u, coll, student, ex) => {
    if (u.role === 'student') return coll !== 'followups' && student === u.id && (!ex || ex.student === u.id);
    if (PRIVATE.includes(coll) || coll === 'shares') return false;
    if (coll === 'followups') return !ex || ex._owner === u.id;
    return true;
  };
  const strip = d => { const { _owner, ...rest } = d; return rest; };
  const deny = msg => { const e = new Error(msg); e.status = 403; throw e; };

  return {
    mode: BASE ? 'http' : 'local',
    get user() { return me; },

    async lookup(username) {
      if (BASE) { try { return await http('GET', '/accounts/by-username/' + encodeURIComponent(username)); } catch (e) { return null; } }
      const u = db().users.find(x => x.username === username);
      return u ? { id: u.id, salt: u.salt, iterations: u.iterations } : null;
    },
    async register(acct) {
      if (BASE) { const r = await http('POST', '/accounts', acct); token = r.token; me = r.user; return me; }
      if (!/^[a-z0-9._-]{3,30}$/.test(acct.username)) throw new Error('Choose a username of 3-30 letters, numbers, dots or dashes.');
      const d = db(); if (d.users.some(u => u.username === acct.username)) throw new Error('That username is taken.');
      const u = { id: rid(), ...acct, name: acct.name || acct.username, profile: acct.profile || {}, created: Date.now() };
      d.users.push(u); save(d); token = 'local'; me = pub(u); return me;
    },
    async login(id, verifier) {
      if (BASE) { try { const r = await http('POST', '/accounts/' + id + '/login', { login_verifier: verifier }); token = r.token; me = r.user; return me; } catch (e) { return null; } }
      const u = db().users.find(x => x.id === id);
      if (!u || u.login_verifier !== verifier) return null;
      token = 'local'; me = pub(u); return me;
    },
    logout() { token = null; me = null; },

    async updateMe(name, profile) {
      if (BASE) { me = await http('PATCH', '/me', { name, profile }); return me; }
      const d = db(), u = d.users.find(x => x.id === me.id); u.name = name; u.profile = profile; save(d); me = pub(u); return me;
    },
    async users(role) {
      if (BASE) return http('GET', '/users?role=' + role);
      if (me.role === 'student' && role !== 'counsellor') deny('Students can only list counsellors.');
      return db().users.filter(u => u.role === role).map(pub);
    },

    async list(coll) {
      if (BASE) return http('GET', '/' + coll);
      return (db().docs[coll] || []).filter(d => canRead(me, coll, d)).map(strip);
    },
    async put(coll, doc) {
      if (BASE) return http('POST', '/' + coll, doc);
      const d = db(), arr = d.docs[coll] = d.docs[coll] || [];
      const b = { ...doc, id: doc.id || rid() };
      b.student = me.role === 'student' ? me.id : doc.student;
      const ex = arr.find(x => x.id === b.id);
      if (!canWrite(me, coll, b.student, ex)) deny('Not allowed.');
      if (PRIVATE.includes(coll) && Object.keys(b).some(k => !['id', 'student', 'ts', 'day', 'iv', 'ct'].includes(k))) deny('Private data must be encrypted.');
      const row = { ...b, _owner: ex ? ex._owner : me.id };
      if (ex) arr[arr.indexOf(ex)] = row; else arr.push(row);
      save(d); return strip(row);
    },
    async patch(coll, id, fields) {
      if (BASE) return http('PATCH', '/' + coll + '/' + id, fields);
      const d = db(), arr = d.docs[coll] || [], ex = arr.find(x => x.id === id);
      if (!ex) throw new Error('not found');
      if (!canWrite(me, coll, ex.student, ex)) deny('Not allowed.');
      let f = fields;
      if (me.role === 'counsellor') f = Object.fromEntries(Object.entries(fields).filter(([k]) => ['status', 'counsellor', 'counsellorName', 'updated', 'done', 'due', 'note'].includes(k)));
      Object.assign(ex, f); save(d); return strip(ex);
    },
    async remove(coll, id) {
      if (BASE) return http('DELETE', '/' + coll + '/' + id);
      const d = db(), arr = d.docs[coll] || [], ex = arr.find(x => x.id === id);
      if (!ex) return; if (!canWrite(me, coll, ex.student, ex)) deny('Not allowed.');
      d.docs[coll] = arr.filter(x => x.id !== id); save(d);
    },
    resetLocal() { mem = null; ls.del(K); }
  };
})();

export default API;
