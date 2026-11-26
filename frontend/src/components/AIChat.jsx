// On-device AI support chat. Messages live only in this component's memory:
// they are never sent to the server or saved, and vanish when you leave the page.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store.jsx';
import { EMO, EmotionBars, MoodFlow } from './ui.jsx';
import Emotion from '../lib/emotion.js';
import { reply, GREETING } from '../lib/companion.js';

export default function AIChat() {
  const { setSafety } = useApp();
  const [msgs, setMsgs] = useState([{ from: 'ai', text: GREETING }]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [analyses, setAnalyses] = useState([]);   // on-device analysis of each of your messages
  const box = useRef(null);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs, typing]);

  function send(e) {
    e.preventDefault(); const t = text.trim(); if (!t) return;
    const turn = msgs.filter(m => m.from === 'me').length;
    setMsgs(m => [...m, { from: 'me', text: t }]); setText(''); setTyping(true);
    setTimeout(() => {                                    // analysed locally, no network
      const r = reply(t, turn), a = Emotion.analyse(t);
      if (a.words) setAnalyses(x => [...x, a]);
      setMsgs(m => [...m, { from: 'ai', text: r.text, emotion: r.emotion }]); setTyping(false);
      if (r.support) setSafety(true);
    }, 600);
  }

  return <div className="glass card chat ai-chat">
    <div className="row between"><h2>🤖 On-device AI</h2><span className="tagc ok">Private · stays on this device</span></div>
    <p className="small muted">Talk through how you feel. The AI reads your emotions and responds with support, without anything leaving your browser.</p>
    <div className="msgs" ref={box}>
      {msgs.map((m, i) => <div key={i} className={'msg' + (m.from === 'me' ? ' me' : '')}>
        <p>{m.text}</p>{m.from === 'ai' && m.emotion && m.emotion !== 'neutral' && <small>Detected: {EMO[m.emotion].emoji} {EMO[m.emotion].label}</small>}</div>)}
      {typing && <div className="msg"><p className="muted">…</p></div>}
    </div>
    {analyses.length > 0 && (() => { const last = analyses[analyses.length - 1], c = {}; analyses.forEach(x => { c[x.primary] = (c[x.primary] || 0) + 1; });
      const top = Object.entries(c).sort((p, q) => q[1] - p[1])[0][0];
      return <div className="ai-viz">
        <h3>📊 Analysis of your last message</h3>
        <p className="small">{EMO[last.primary].emoji} <b style={{ color: EMO[last.primary].color }}>{EMO[last.primary].label}</b> · {last.confidence} confidence · {last.explanation}</p>
        <EmotionBars breakdown={last.breakdown} intensity={last.intensity} />
        <h3 style={{ marginTop: 12 }}>📈 Your mood through this chat</h3>
        <MoodFlow items={analyses} />
        <p className="small muted">{c[top] > 1 ? <>Mostly {EMO[top].emoji} {EMO[top].label}</> : <>A mix of {Object.keys(c).map(k => EMO[k].emoji + ' ' + EMO[k].label).join(', ')}</>} across {analyses.length} message{analyses.length === 1 ? '' : 's'}. Analysed in your browser; not saved or sent.</p>
      </div>; })()}
    <form className="reply" data-form="aiChat" onSubmit={send}><input value={text} onChange={e => setText(e.target.value)} placeholder="Type how you're feeling…" maxLength={1000} /><button className="btn primary">Send</button></form>
    <p className="proto">Prototype: a rule-based model in your browser, not a therapist. It can't diagnose or handle emergencies. For real support, request a counsellor.</p>
  </div>;
}
