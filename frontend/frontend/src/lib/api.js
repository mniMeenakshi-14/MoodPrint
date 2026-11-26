// ============================================================
// MOODPRINT FRONTEND API
// Connects React to the Flask backend.
// Private journal and check-in data are encrypted before upload.
// ============================================================

const API = (() => {
  const BASE = import.meta.env.VITE_API_URL || window.MOODPRINT_API || null;

  const K = 'moodprint-campus-v1';
  const PRIVATE = ['entries', 'checkins'];

  let token = null;
  let me = null;
  let mem = null;

  // ----------------------------------------------------------
  // LOCAL STORAGE
  // ----------------------------------------------------------

  const ls = {
    get: k => {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },

    set: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch (e) {}
    },

    del: k => {
      try {
        localStorage.removeItem(k);
      } catch (e) {}
    }
  };

  const db = () => {
    const r = ls.get(K);
    return r ? JSON.parse(r) : (mem || { users: [], docs: {} });
  };

  const save = d => {
    mem = d;
    ls.set(K, JSON.stringify(d));
  };

  const pub = u => ({
    id: u.id,
    role: u.role,
    username: u.username,
    name: u.name,
    profile: u.profile || {}
  });

  const rid = () =>
    Array.from(
      crypto.getRandomValues(new Uint8Array(6)),
      b => b.toString(16).padStart(2, '0')
    ).join('');

  const timestamp = value => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  };

  // ----------------------------------------------------------
  // HTTP REQUEST
  // ----------------------------------------------------------

  async function http(method, path, body) {
    const r = await fetch(BASE + path, {
      method,

      headers: {
        'Content-Type': 'application/json',
        ...(token
          ? { Authorization: 'Bearer ' + token }
          : {})
      },

      body: body ? JSON.stringify(body) : undefined
    });

    if (r.status === 204) return null;

    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      const e = new Error(j.error || r.statusText);
      e.status = r.status;
      throw e;
    }

    return j;
  }

  // ----------------------------------------------------------
  // LOCAL MODE HELPERS
  // ----------------------------------------------------------

  const canRead = (u, coll, d) => {
    if (u.role === 'student') return d.student === u.id;
    if (PRIVATE.includes(coll)) return false;
    if (coll === 'shares') return !!d.active;
    if (coll === 'followups') return d._owner === u.id;
    return true;
  };

  const canWrite = (u, coll, student, ex) => {
    if (u.role === 'student') {
      return (
        coll !== 'followups' &&
        student === u.id &&
        (!ex || ex.student === u.id)
      );
    }

    if (PRIVATE.includes(coll) || coll === 'shares') return false;
    if (coll === 'followups') return !ex || ex._owner === u.id;

    return true;
  };

  const strip = d => {
    const { _owner, ...rest } = d;
    return rest;
  };

  const deny = msg => {
    const e = new Error(msg);
    e.status = 403;
    throw e;
  };

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------

  return {
    mode: BASE ? 'http' : 'local',

    get user() {
      return me;
    },

    // --------------------------------------------------------
    // ACCOUNT LOOKUP
    // --------------------------------------------------------

    async lookup(username) {
      if (BASE) {
        try {
          const result = await http(
            'GET',
            '/accounts/by-username/' + encodeURIComponent(username)
          );

          if (result.exists === false) {
            return null;
          }

          return result;
        } catch (e) {
          console.error('Account lookup failed:', e);
          return null;
        }
      }

      const u = db().users.find(x => x.username === username);

      return u
        ? {
            id: u.id,
            salt: u.salt,
            iterations: u.iterations
          }
        : null;
    },

    // --------------------------------------------------------
    // REGISTER
    // --------------------------------------------------------

    async register(acct) {
      if (BASE) {
        const r = await http('POST', '/accounts', acct);

        token = r.token;
        me = r.user;

        return me;
      }

      if (!/^[a-z0-9._-]{3,30}$/.test(acct.username)) {
        throw new Error(
          'Choose a username of 3-30 letters, numbers, dots or dashes.'
        );
      }

      const d = db();

      if (d.users.some(u => u.username === acct.username)) {
        throw new Error('That username is taken.');
      }

      const u = {
        id: rid(),
        ...acct,
        name: acct.name || acct.username,
        profile: acct.profile || {},
        created: Date.now()
      };

      d.users.push(u);
      save(d);

      token = 'local';
      me = pub(u);

      return me;
    },

    // --------------------------------------------------------
    // LOGIN
    // --------------------------------------------------------

    async login(id, verifier) {
      if (BASE) {
        try {
          const r = await http(
            'POST',
            '/accounts/' + id + '/login',
            { login_verifier: verifier }
          );

          token = r.token;
          me = r.user;

          return me;
        } catch (e) {
          return null;
        }
      }

      const u = db().users.find(x => x.id === id);

      if (!u || u.login_verifier !== verifier) {
        return null;
      }

      token = 'local';
      me = pub(u);

      return me;
    },

    logout() {
      token = null;
      me = null;
    },

    // --------------------------------------------------------
    // UPDATE PROFILE
    // --------------------------------------------------------

    async updateMe(name, profile) {
      if (BASE) {
        const meResponse = await http('PATCH', '/me', {
          name,
          profile
        });

        me = meResponse.user || meResponse;
        return me;
      }

      const d = db();
      const u = d.users.find(x => x.id === me.id);

      u.name = name;
      u.profile = profile;

      save(d);
      me = pub(u);

      return me;
    },

    // --------------------------------------------------------
    // USERS
    // Counsellor/student listing is not implemented yet.
    // --------------------------------------------------------

    async users(role) {
      if (BASE) {
        return [];
      }

      if (me.role === 'student' && role !== 'counsellor') {
        deny('Students can only list counsellors.');
      }

      return db().users
        .filter(u => u.role === role)
        .map(pub);
    },

    // --------------------------------------------------------
    // GET COLLECTION
    // --------------------------------------------------------

    async list(coll) {

      // ---------------- HTTP BACKEND ----------------

      if (BASE) {

        // JOURNALS
        if (coll === 'entries') {
          const r = await http('GET', '/journals/');

          return (r.journals || []).map(j => ({
            id: j.journal_id,
            ts: timestamp(j.created_at),
            iv: j.iv,
            ct: j.encrypted_content
          }));
        }

        // DAILY CHECK-INS
        if (coll === 'checkins') {
          const r = await http('GET', '/checkins/');

          return (r.checkins || []).map(c => ({
            id: c.id,
            day: c.day,
            ts: timestamp(c.created_at),
            iv: c.iv,
            ct: c.encrypted_content
          }));
        }

        // These features need separate backend APIs.
        return [];
      }

      // ---------------- LOCAL MODE ----------------

      return (db().docs[coll] || [])
        .filter(d => canRead(me, coll, d))
        .map(strip);
    },

    // --------------------------------------------------------
    // SAVE OR UPDATE COLLECTION
    // --------------------------------------------------------

    async put(coll, doc) {

      // ---------------- HTTP BACKEND ----------------

      if (BASE) {

        // JOURNAL SAVE / UPDATE
        if (coll === 'entries') {

          const journalId = doc.id || rid();

          const payload = {
            encrypted_content: doc.ct,
            iv: doc.iv
          };

          if (doc.id) {
            await http(
              'PUT',
              '/journals/' + encodeURIComponent(journalId),
              payload
            );
          } else {
            await http('POST', '/journals/', {
              journal_id: journalId,
              ...payload
            });
          }

          return {
            id: journalId,
            ts: doc.ts || Date.now(),
            iv: doc.iv,
            ct: doc.ct
          };
        }

        // DAILY CHECK-IN SAVE / UPDATE
        if (coll === 'checkins') {

          const payload = {
            encrypted_content: doc.ct,
            iv: doc.iv
          };

          if (doc.id) {
            await http(
              'PUT',
              '/checkins/' + encodeURIComponent(doc.id),
              payload
            );

            return {
              id: doc.id,
              ts: doc.ts || Date.now(),
              day: doc.day,
              iv: doc.iv,
              ct: doc.ct
            };
          }

          const r = await http('POST', '/checkins/', {
            day: doc.day,
            ...payload
          });

          const c = r.checkin;

          return {
            id: c.id,
            ts: Date.now(),
            day: c.day,
            iv: c.iv,
            ct: c.encrypted_content
          };
        }

        throw new Error(
          'This feature is not connected to the backend yet: ' + coll
        );
      }

      // ---------------- LOCAL MODE ----------------

      const d = db();
      const arr = d.docs[coll] = d.docs[coll] || [];

      const b = {
        ...doc,
        id: doc.id || rid()
      };

      b.student = me.role === 'student' ? me.id : doc.student;

      const ex = arr.find(x => x.id === b.id);

      if (!canWrite(me, coll, b.student, ex)) {
        deny('Not allowed.');
      }

      if (
        PRIVATE.includes(coll) &&
        Object.keys(b).some(
          k => !['id', 'student', 'ts', 'day', 'iv', 'ct'].includes(k)
        )
      ) {
        deny('Private data must be encrypted.');
      }

      const row = {
        ...b,
        _owner: ex ? ex._owner : me.id
      };

      if (ex) {
        arr[arr.indexOf(ex)] = row;
      } else {
        arr.push(row);
      }

      save(d);

      return strip(row);
    },

    // --------------------------------------------------------
    // PATCH COLLECTION
    // --------------------------------------------------------

    async patch(coll, id, fields) {

      if (BASE) {
        throw new Error(
          'This feature is not connected to the backend yet: ' + coll
        );
      }

      const d = db();
      const arr = d.docs[coll] || [];
      const ex = arr.find(x => x.id === id);

      if (!ex) {
        throw new Error('not found');
      }

      if (!canWrite(me, coll, ex.student, ex)) {
        deny('Not allowed.');
      }

      let f = fields;

      if (me.role === 'counsellor') {
        f = Object.fromEntries(
          Object.entries(fields).filter(
            ([k]) =>
              [
                'status',
                'counsellor',
                'counsellorName',
                'updated',
                'done',
                'due',
                'note'
              ].includes(k)
          )
        );
      }

      Object.assign(ex, f);
      save(d);

      return strip(ex);
    },

    // --------------------------------------------------------
    // DELETE COLLECTION ITEM
    // --------------------------------------------------------

    async remove(coll, id) {

      if (BASE) {

        if (coll === 'entries') {
          await http(
            'DELETE',
            '/journals/' + encodeURIComponent(id)
          );
          return;
        }

        if (coll === 'checkins') {
          await http(
            'DELETE',
            '/checkins/' + encodeURIComponent(id)
          );
          return;
        }

        throw new Error(
          'This feature is not connected to the backend yet: ' + coll
        );
      }

      const d = db();
      const arr = d.docs[coll] || [];
      const ex = arr.find(x => x.id === id);

      if (!ex) return;

      if (!canWrite(me, coll, ex.student, ex)) {
        deny('Not allowed.');
      }

      d.docs[coll] = arr.filter(x => x.id !== id);

      save(d);
    },

    // --------------------------------------------------------
    // RESET LOCAL MODE
    // --------------------------------------------------------

    resetLocal() {
      mem = null;
      ls.del(K);
    }
  };
})();

export default API;