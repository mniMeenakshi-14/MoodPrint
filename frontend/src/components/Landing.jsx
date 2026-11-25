// Landing page shown before sign in.
const FEATURES = [
  ['🔐', 'Encrypted on your device', 'Your passphrase creates a vault key with PBKDF2. Every entry is locked with AES-256-GCM before it is stored.'],
  ['🧠', 'On-device emotion analysis', 'Detects 12 emotions with intensity, confidence and a plain-language explanation, right in your browser.'],
  ['📈', 'Mood graphs', 'See your mood over time, your emotion mix and weekly patterns at a glance.'],
  ['💬', 'AI analysis', 'Type how you feel and get an instant breakdown with graphs. Nothing is sent anywhere.'],
  ['📴', 'Works offline', 'Write, analyse and review your journal even without internet.'],
  ['🤝', 'Safety support', 'If an entry sounds heavy, MoodPrint gently shows helplines like Tele-MANAS 14416.'],
];

const STEPS = [
  ['1', 'Create your vault', 'Pick a name and a passphrase. Only you know it.'],
  ['2', 'Write freely', 'Journal your day. Emotions are analysed as you type.'],
  ['3', 'Understand yourself', 'Track patterns with mood graphs and AI analysis.'],
];

const BARS = [['😢 Sad', 62, '#60a5fa'], ['🥺 Lonely', 24, '#818cf8'], ['😣 Stressed', 14, '#fb7185']];

export default function Landing({ onStart }) {
  return (
    <div className="landing">
      <nav className="l-nav">
        <b className="l-logo">MoodPrint</b>
        <button className="btn ghost" onClick={onStart}>Sign in</button>
      </nav>

      <section className="l-hero">
        <div>
          <span className="pill">Private · On-device · Offline</span>
          <h1>Understand how you feel.<br /><span className="grad-text">Keep it yours.</span></h1>
          <p className="muted l-lead">MoodPrint is a private mood journal. Your entries are encrypted in your browser and your emotions are analysed on your device, never on a server.</p>
          <div className="row">
            <button className="btn primary" onClick={onStart}>Get started</button>
            <a className="btn ghost" href="#features">See features</a>
          </div>
        </div>
        <div className="glass l-demo">
          <small className="muted">Today, 9:41 PM</small>
          <p>"Everyone went out without me and I have exams tomorrow…"</p>
          <div className="row"><span className="echip" style={{ '--c': '#60a5fa' }}>😢 Sad</span><span className="small muted">Intensity 78 · High confidence</span></div>
          {BARS.map(([l, v, c]) => (
            <div className="l-bar" key={l}><span>{l}</span><div><i style={{ width: v + '%', background: c }} /></div><b>{v}%</b></div>
          ))}
          <svg viewBox="0 0 300 80" className="l-spark">
            <polyline fill="none" stroke="url(#lg)" strokeWidth="3" points="0,50 40,35 80,45 120,20 160,30 200,55 240,40 300,25" />
            <defs><linearGradient id="lg"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#7dd3fc" /></linearGradient></defs>
          </svg>
        </div>
      </section>

      <section id="features">
        <h2 className="l-h2">Everything you need, nothing you don't share</h2>
        <div className="l-grid">
          {FEATURES.map(([i, t, d]) => (
            <div className="glass l-card" key={t}><span className="l-ico">{i}</span><h3>{t}</h3><p className="muted small">{d}</p></div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="l-h2">How it works</h2>
        <div className="l-grid three">
          {STEPS.map(([n, t, d]) => (
            <div className="glass l-card" key={n}><span className="l-num">{n}</span><h3>{t}</h3><p className="muted small">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="glass l-cta">
        <h2>Your feelings deserve privacy.</h2>
        <p className="muted">Start your encrypted journal in under a minute.</p>
        <button className="btn primary" onClick={onStart}>Create your vault</button>
      </section>

      <footer className="small muted">MoodPrint supports wellbeing. It does not diagnose. In crisis, call Tele-MANAS 14416 or 112.</footer>
    </div>
  );
}