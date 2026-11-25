// Sidebar + header + current page
import { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';
import { Avatar } from './ui.jsx';
import { dayKey } from '../lib/util.js';
import { PAGES, NAV } from '../pages/index.js';

export default function Shell() {
  const { user, page, go, d, lock } = useApp();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => { const f = () => setOnline(navigator.onLine); addEventListener('online', f); addEventListener('offline', f); return () => { removeEventListener('online', f); removeEventListener('offline', f); }; }, []);
  const P = PAGES[page] || PAGES[user.role === 'student' ? 'overview' : 'c-dash'];
  const badge = k => {
    if (user.role === 'counsellor') {
      if (k === 'c-requests') return d.requests?.filter(r => r.status === 'pending').length || 0;
      if (k === 'c-followups') return d.followups?.filter(f => !f.done && f.due <= dayKey(Date.now())).length || 0;
    } else if (k === 'checkin') return d.checkins?.some(c => c.day === dayKey(Date.now())) ? 0 : '•';
    return 0;
  };
  const Page = P.Component;
  return (
    <div id="shell">
      <aside>
        <div className="logo"><span className="dot" />MoodPrint</div>
        <nav id="nav">
          {NAV[user.role].map(([group, keys]) => <div key={group} style={{ display: 'contents' }}>
            <div className="ng">{group}</div>
            {keys.map(k => { const b = badge(k); return (
              <button key={k} className={'nv' + (P === PAGES[k] ? ' on' : '')} data-p={k} onClick={() => go(k)}>
                <span>{PAGES[k].icon}</span>{PAGES[k].title}{b ? <em className="badge">{b}</em> : null}
              </button>); })}
          </div>)}
        </nav>
        <div className="side-foot">
          <div className="mechip"><Avatar name={user.name} /><div><b>{user.name}</b><small>{user.role === 'student' ? 'Student' : 'Counsellor'}</small></div></div>
          <button className="btn ghost sm wide" id="lockBtn" onClick={() => lock()}>🔒 Lock vault</button>
        </div>
      </aside>
      <main>
        <header className="top">
          <div><h1>{P.title}</h1><p className="muted">{typeof P.sub === 'function' ? P.sub(user) : P.sub}</p></div>
          <div className="row"><span className={'pill' + (online ? '' : ' off')}>{online ? 'Online' : 'Offline · still works'}</span><button className="btn ghost sm mob-only" id="lockBtn2" onClick={() => lock()}>🔒</button></div>
        </header>
        <div id="page" className="in" key={page}><Page /></div>
      </main>
    </div>
  );
}
