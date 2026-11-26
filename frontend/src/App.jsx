import { useEffect, useRef, useState } from 'react';
import { AppProvider, useApp } from './store.jsx';
import Auth from './components/Auth.jsx';
import Landing from './components/Landing.jsx';
import Shell from './components/Shell.jsx';
import { Toast } from './components/ui.jsx';

function Safety() {
  const { safety, setSafety, setUi, go } = useApp();
  const close = useRef(null);
  useEffect(() => { if (safety) close.current?.focus(); }, [safety]);
  if (!safety) return null;
  return (
    <div className="overlay" id="safety">
      <div className="glass modal" role="dialog" aria-modal="true" aria-labelledby="safeTitle">
        <h2 id="safeTitle">You don't have to go through this alone</h2>
        <p>It sounds like you're carrying something really painful right now. Please reach out to someone you trust, a friend, family member or teacher, and let them know how you're feeling.</p>
        <ul className="help">
          <li><b>Tele-MANAS 14416</b> free, confidential, 24×7 (India)</li>
          <li><b>112</b> if you are in immediate danger</li>
        </ul>
        <p className="small muted">MoodPrint can't diagnose anything or provide emergency help, but people can.</p>
        <div className="row">
          <button className="btn primary" onClick={() => { setSafety(false); go('support'); }}>Get support</button>
          <button className="btn ghost" id="safeClose" ref={close} onClick={() => setSafety(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Root() {
  const { user, toastMsg } = useApp();
  const [started, setStarted] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, [started]);
  return <>
    <div className="glow g1" /><div className="glow g2" />
    {user ? <Shell /> : started ? <Auth /> : <Landing onStart={() => setStarted(true)} />}
    <Safety />
    <Toast msg={toastMsg} />
  </>;
}

export default function App() {
  return <AppProvider><Root /></AppProvider>;
}