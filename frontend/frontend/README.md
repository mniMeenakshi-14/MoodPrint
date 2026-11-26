# MoodPrint (React): private mood journal with counsellor support

## Run it (no npm needed)

```
python app.py
```
This opens http://localhost:8000, using the ready-built React app in `dist/` and the Python backend (SQLite, `moodprint.db`).

On the sign-in screen, click **Set up demo**:
- Students `diya`, `aarav`, `kabir`, passphrase `student-demo`
- Counsellor `dr.rao`, passphrase `counsellor-demo`

## Develop with React + Vite (needs Node.js)

```
npm install
npm run dev        # React dev server at http://localhost:5173
npm run build      # rebuilds dist/ for app.py
```
To use the Python backend while running `npm run dev`, keep `python app.py` running in another terminal and copy `.env.example` to `.env`. Vite forwards `/api` to the backend.

## Code map

| Part | File |
|---|---|
| App state (user, data, navigation, settings) | `src/store.jsx` |
| Root, safety panel | `src/App.jsx` |
| Sign in / create account / demo | `src/components/Auth.jsx` |
| Sidebar layout | `src/components/Shell.jsx` |
| Shared UI (emotion chips, picker, charts, summary) | `src/components/ui.jsx` |
| Student pages | `src/pages/student/*.jsx` (Overview, Checkin, Journal, Analysis, History, Patterns, Support, Vault) |
| Counsellor pages | `src/pages/counsellor/Pages.jsx` (Dashboard, Requests, Students, Analytics, Messages, Followups) |
| Profile (settings) | `src/pages/Profile.jsx` |
| Page list and navigation | `src/pages/index.js` |
| Emotion analysis (12 emotions, prototype keyword model) | `src/lib/emotion.js` |
| Mood maths and anonymised summaries | `src/lib/data.js` |
| Charts | `src/lib/charts.js` |
| Encryption (PBKDF2 + AES-256-GCM, Web Crypto) | `src/lib/vault.js` |
| Frontend ↔ backend | `src/lib/api.js` |
| Backend + privacy rules | `app.py` |

## Privacy rules (enforced by the server)

- The server never receives passphrases or vault keys. It stores only a salt and a login verifier.
- Journal entries and check-ins are stored as IV + ciphertext only. Plaintext is rejected.
- Counsellors can never read journal entries or check-ins, even as ciphertext.
- Counsellors see a student's mood summary only while that student's consent is active.

The emotion analysis is a prototype keyword model, not a trained AI model. MoodPrint does not diagnose.
