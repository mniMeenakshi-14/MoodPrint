// ============================================================
// CLIENT-SIDE VAULT ENCRYPTION (Web Crypto API)
// passphrase -> PBKDF2-SHA-256 (310k) -> 512 bits
//   first 256  -> vault key (AES-256-GCM, non-extractable, memory only)
//   second 256 -> login key -> SHA-256 -> login verifier (sent to server)
// The two keys are independent, so the server's verifier can't decrypt.
// ============================================================
const Vault = (() => {
  const ITER = 310000, te = new TextEncoder(), td = new TextDecoder();
  const b64 = u => { u = new Uint8Array(u); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const hex = u => [...new Uint8Array(u)].map(b => b.toString(16).padStart(2, '0')).join('');
  let key = null;

  async function derive(pass, salt, iterations = ITER) {
    const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(salt), iterations, hash: 'SHA-256' }, base, 512));
    const vaultKey = await crypto.subtle.importKey('raw', bits.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    const verifier = hex(await crypto.subtle.digest('SHA-256', bits.slice(32)));
    bits.fill(0);
    return { vaultKey, verifier };
  }

  return {
    ITER,
    supported: () => !!(window.crypto && crypto.subtle),
    newSalt: () => b64(crypto.getRandomValues(new Uint8Array(16))),
    newId: () => hex(crypto.getRandomValues(new Uint8Array(6))),
    bytes: s => unb64(s).length,

    // Derives both keys; keeps the vault key in memory, returns the login verifier.
    async unlock(pass, salt, iterations) { const k = await derive(pass, salt, iterations); key = k.vaultKey; return k.verifier; },
    lock() { key = null; },

    async seal(obj) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
      return { iv: b64(iv), ct: b64(ct) };
    },
    async open(row) {
      return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(row.iv) }, key, unb64(row.ct))));
    }
  };
})();

export default Vault;
