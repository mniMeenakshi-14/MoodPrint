"""
MoodPrint server: pure Python, nothing to install.

    python app.py

* Serves the MoodPrint React app (the built files in ./dist) at http://localhost:8000
* Multi-user backend (students + counsellors) stored in SQLite (moodprint.db)

Privacy rules enforced here:
* Passphrases and vault keys never reach the server (only a salt + login verifier).
* Journal entries and daily check-ins are stored ONLY as ciphertext (IV + ciphertext).
* Counsellors can never read journal entries or check-ins, even as ciphertext.
* Counsellors only see a student's mood summary while that student's consent is active.
"""
import hmac
import json
import os
import re
import secrets
import sqlite3
import sys
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", 8000))
HERE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(HERE, "dist")
DB_PATH = os.path.join(HERE, "moodprint.db")
TOKENS = {}                       # session token -> user id (kept in memory only)
LOCK = threading.Lock()

# collection -> who may read / write it
PRIVATE = {"entries", "checkins"}                       # owner student only, ciphertext only
SHARED = {"requests", "messages", "appointments"}       # owner student + counsellors
CONSENT = {"shares"}                                    # owner student; counsellors only while active
COUNSELLOR_ONLY = {"followups"}                         # the counsellor who created it
COLLECTIONS = PRIVATE | SHARED | CONSENT | COUNSELLOR_ONLY


def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    with db() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, role TEXT NOT NULL, username TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL, profile TEXT NOT NULL DEFAULT '{}',
            salt TEXT NOT NULL, iterations INTEGER NOT NULL, login_verifier TEXT NOT NULL, created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS docs (
            coll TEXT NOT NULL, id TEXT NOT NULL, student TEXT NOT NULL, owner TEXT NOT NULL,
            data TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (coll, id));
        """)


def say(icon, msg):
    print(f"  {icon}  {msg}", flush=True)


def public_user(r):
    return {"id": r["id"], "role": r["role"], "username": r["username"], "name": r["name"], "profile": json.loads(r["profile"])}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=STATIC, **kw)

    def log_message(self, *args):
        pass

    # ---------- helpers
    def send_json(self, code, obj=None):
        body = b"" if obj is None else json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 2_000_000:
            raise ValueError("too large")
        return json.loads(self.rfile.read(n) or b"{}")

    def me(self, con):
        auth = self.headers.get("Authorization", "")
        uid = TOKENS.get(auth[7:]) if auth.startswith("Bearer ") else None
        return con.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone() if uid else None

    # ---------- static files (never serve the database or server code)
    def do_GET(self):
        if self.path.startswith("/api/"):
            return self.api("GET")
        path = self.path.split("?")[0]
        if path.endswith((".db", ".py")) or "/." in path:
            return self.send_error(404)
        if path in ("/", "/index.html"):
            with open(os.path.join(STATIC, "index.html"), "rb") as f:
                html = f.read().replace(b"<head>", b"<head><script>window.MOODPRINT_API='/api'</script>", 1)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html)))
            self.end_headers()
            return self.wfile.write(html)
        return super().do_GET()

    def do_POST(self):
        self.api("POST")

    def do_PATCH(self):
        self.api("PATCH")

    def do_DELETE(self):
        self.api("DELETE")

    # ---------- access rules
    def can_read(self, user, coll, row):
        data = json.loads(row["data"])
        if user["role"] == "student":
            return row["student"] == user["id"]
        if coll in PRIVATE:
            return False                                   # counsellors never see journals
        if coll in CONSENT:
            return bool(data.get("active"))
        if coll in COUNSELLOR_ONLY:
            return row["owner"] == user["id"]
        return True                                        # requests / messages / appointments

    def can_write(self, user, coll, student, existing):
        if user["role"] == "student":
            return coll != "followups" and student == user["id"] and (existing is None or existing["student"] == user["id"])
        if coll in PRIVATE or coll in CONSENT:
            return False
        if coll in COUNSELLOR_ONLY:
            return existing is None or existing["owner"] == user["id"]
        return True

    # ---------- API
    def api(self, method):
        p = self.path.split("?")[0]
        q = dict(x.split("=", 1) for x in self.path.split("?", 1)[1].split("&") if "=" in x) if "?" in self.path else {}
        try:
            with LOCK, db() as con:
                # register: { role, username, name, salt, iterations, login_verifier }
                if method == "POST" and p == "/api/accounts":
                    b = self.read_json()
                    if b.get("role") not in ("student", "counsellor") or not re.fullmatch(r"[a-z0-9._-]{3,30}", str(b.get("username", ""))):
                        return self.send_json(400, {"error": "Choose a username of 3-30 letters, numbers, dots or dashes."})
                    if con.execute("SELECT 1 FROM users WHERE username=?", (b["username"],)).fetchone():
                        return self.send_json(409, {"error": "That username is taken."})
                    uid = secrets.token_hex(8)
                    con.execute("INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?)",
                                (uid, b["role"], b["username"], str(b.get("name") or b["username"])[:60], json.dumps(b.get("profile") or {}),
                                 str(b["salt"]), int(b["iterations"]), str(b["login_verifier"]), int(time.time() * 1000)))
                    tok = secrets.token_urlsafe(24)
                    TOKENS[tok] = uid
                    say("🆕", f"New {b['role']} account '{b['username']}': stored salt + login verifier only")
                    row = con.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
                    return self.send_json(201, {"token": tok, "user": public_user(row)})

                # look up salt for login
                m = re.fullmatch(r"/api/accounts/by-username/([a-z0-9._-]+)", p)
                if method == "GET" and m:
                    r = con.execute("SELECT id, salt, iterations FROM users WHERE username=?", (m[1],)).fetchone()
                    return self.send_json(200, dict(r)) if r else self.send_json(404, {"error": "No account with that username."})

                m = re.fullmatch(r"/api/accounts/(\w+)/login", p)
                if method == "POST" and m:
                    b = self.read_json()
                    r = con.execute("SELECT * FROM users WHERE id=?", (m[1],)).fetchone()
                    if not r or not hmac.compare_digest(r["login_verifier"], str(b.get("login_verifier", ""))):
                        say("⛔", "Login rejected: wrong passphrase")
                        return self.send_json(401, {"error": "wrong passphrase"})
                    tok = secrets.token_urlsafe(24)
                    TOKENS[tok] = r["id"]
                    say("🔓", f"{r['role'].title()} '{r['username']}' signed in (server only compared verifiers)")
                    return self.send_json(200, {"token": tok, "user": public_user(r)})

                user = self.me(con)
                if not user:
                    return self.send_json(401, {"error": "Please sign in."})

                if p == "/api/me" and method == "PATCH":
                    b = self.read_json()
                    con.execute("UPDATE users SET name=?, profile=? WHERE id=?", (str(b.get("name") or user["name"])[:60], json.dumps(b.get("profile") or {}), user["id"]))
                    return self.send_json(200, public_user(con.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()))

                if p == "/api/users" and method == "GET":
                    role = q.get("role")
                    if user["role"] == "student" and role != "counsellor":
                        return self.send_json(403, {"error": "Students can only list counsellors."})
                    rows = con.execute("SELECT * FROM users WHERE role=?", (role,)).fetchall()
                    return self.send_json(200, [public_user(r) for r in rows])

                m = re.fullmatch(r"/api/(\w+)(?:/([\w-]+))?", p)
                if not m or m[1] not in COLLECTIONS:
                    return self.send_json(404, {"error": "unknown route"})
                coll, did = m[1], m[2]

                if method == "GET" and not did:
                    rows = con.execute("SELECT * FROM docs WHERE coll=? ORDER BY updated", (coll,)).fetchall()
                    return self.send_json(200, [json.loads(r["data"]) for r in rows if self.can_read(user, coll, r)])

                if method == "POST" and not did:
                    b = self.read_json()
                    if coll in PRIVATE and set(b) - {"id", "student", "ts", "day", "iv", "ct"}:
                        return self.send_json(400, {"error": "Private data must be encrypted (iv + ct only)."})
                    b["id"] = b.get("id") or secrets.token_hex(6)
                    student = user["id"] if user["role"] == "student" else str(b.get("student", ""))
                    b["student"] = student
                    existing = con.execute("SELECT * FROM docs WHERE coll=? AND id=?", (coll, b["id"])).fetchone()
                    if not self.can_write(user, coll, student, existing):
                        return self.send_json(403, {"error": "Not allowed."})
                    con.execute("INSERT OR REPLACE INTO docs VALUES (?,?,?,?,?,?)",
                                (coll, b["id"], student, existing["owner"] if existing else user["id"], json.dumps(b), int(time.time() * 1000)))
                    self.log_write(user, coll, b)
                    return self.send_json(201, b)

                existing = con.execute("SELECT * FROM docs WHERE coll=? AND id=?", (coll, did)).fetchone()
                if not existing:
                    return self.send_json(404, {"error": "not found"})
                if not self.can_write(user, coll, existing["student"], existing):
                    return self.send_json(403, {"error": "Not allowed."})

                if method == "PATCH":
                    b = self.read_json()
                    data = json.loads(existing["data"])
                    if user["role"] == "counsellor":           # counsellors may only change status-type fields
                        b = {k: v for k, v in b.items() if k in ("status", "counsellor", "counsellorName", "updated", "done", "due", "note")}
                    data.update({k: v for k, v in b.items() if k not in ("id", "student")})
                    con.execute("UPDATE docs SET data=?, updated=? WHERE coll=? AND id=?", (json.dumps(data), int(time.time() * 1000), coll, did))
                    self.log_write(user, coll, data, "updated")
                    return self.send_json(200, data)

                if method == "DELETE":
                    con.execute("DELETE FROM docs WHERE coll=? AND id=?", (coll, did))
                    say("🗑️ ", f"{coll[:-1]} {did} deleted by {user['username']}")
                    return self.send_json(204)

                return self.send_json(405, {"error": "method not allowed"})
        except (ValueError, KeyError, TypeError, json.JSONDecodeError, sqlite3.IntegrityError) as e:
            return self.send_json(400, {"error": str(e)})

    def log_write(self, user, coll, b, verb="saved"):
        who = user["username"]
        if coll in PRIVATE:
            say("🔒", f"{'Journal entry' if coll == 'entries' else 'Check-in'} {verb} for {who}: iv={b.get('iv')} ciphertext={str(b.get('ct'))[:28]}… (unreadable)")
        elif coll == "shares":
            say("🤝", f"Consent {'active' if b.get('active') else 'REVOKED'} for {who}: scope={','.join(k for k, v in (b.get('scope') or {}).items() if v) or 'none'}")
        elif coll == "messages":
            say("💬", f"Message from {who} on request {b.get('request')}")
        else:
            say("📌", f"{coll[:-1].title()} {verb} by {who}: {b.get('status', '')}")


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    if not os.path.exists(os.path.join(STATIC, "index.html")):
        sys.exit("dist/index.html not found. Run `npm run build` first (or use the prebuilt dist folder).")
    init_db()
    url = f"http://localhost:{PORT}"
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"\n  ✨ MoodPrint is running at {url}")
    print(f"  🗄️  Database: {DB_PATH}")
    print("  Press Ctrl+C to stop.\n")
    threading.Timer(1, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")
