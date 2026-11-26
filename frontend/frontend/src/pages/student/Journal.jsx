import { useMemo, useState } from 'react';
import { useApp } from '../../store.jsx';
import { EMO, IBar, Conf, Picker, EmotionBars } from '../../components/ui.jsx';
import Emotion from '../../lib/emotion.js';
import { moodOf } from '../../lib/data.js';
import { fmtDateTime, plural } from '../../lib/util.js';

function Live({ text, pick, setPick }) {
  const [open, setOpen] = useState(false);
  const a = useMemo(() => Emotion.analyse(text), [text]);           // on-device, as you type
  if (!a.words) return <p className="muted small">Your emotions will be analysed here as you write.</p>;
  const k = pick || a.primary, m = EMO[k];
  return <>
    <div className="live"><span className="big-emo sm">{m.emoji}</span><div>
      <b style={{ color: m.color }}>{m.label}</b>{a.secondaries.length > 0 && <span className="small muted"> with {a.secondaries.map(s => EMO[s].emoji + ' ' + EMO[s].label).join(', ')}</span>}
      <div className="irow small"><IBar v={a.intensity} color={m.color} /> <Conf c={a.confidence} suffix=" confidence" /></div>
      <p className="small">{a.explanation}</p>
      <EmotionBars breakdown={a.breakdown} />
      {pick && pick !== a.primary && <p className="small corr">You set this to {m.emoji} {m.label}. The AI suggested {EMO[a.primary].emoji} {EMO[a.primary].label}.</p>}
    </div></div>
    <button type="button" className="btn ghost sm" onClick={() => setOpen(!open)}>Edit mood</button>
    {open && <Picker value={k} ai={a.primary} onPick={x => { setPick(x === a.primary ? null : x); setOpen(false); }} />}
  </>;
}

export default function Journal() {
  const { d, ui, setUi, saveEntry, toast, setSafety } = useApp();
  const editing = ui.editing && d.entries.find(e => e.id === ui.editing);
  const [text, setText] = useState(editing ? editing.text : (ui.draft || ''));
  const [pick, setPick] = useState(editing ? editing.userEmotion : (ui.pick || null));
  const [busy, setBusy] = useState(false);
  const words = (text.match(/\S+/g) || []).length;

  async function save() {
    if (!text.trim()) return; setBusy(true);
    const e = await saveEntry(text.trim(), pick, editing ? editing.id : null);
    toast(editing ? 'Entry updated and re-encrypted.' : 'Saved securely. Analysed as ' + EMO[moodOf(e)].label + '.');
    setUi({ draft: '', editing: null, pick: null }); setText(''); setPick(null); setBusy(false);
    if (e.emo.support) setSafety(true);
  }
  function cancel() { setUi({ editing: null, draft: '' }); setText(''); setPick(null); }

  return <div className="journal">
    <div className="glass card">
      <div className="row between"><h2>{editing ? 'Edit entry' : 'New entry'}</h2><span className="small muted">{fmtDateTime(editing ? editing.ts : Date.now())}</span></div>
      <textarea id="jText" className="paper" placeholder="Write about your day…" value={text} autoFocus={!editing} onChange={e => { setText(e.target.value); setUi({ draft: e.target.value }); }} />
      <div className="row between"><span className="small muted">{plural(words, 'word')}</span>
        <span className="row">{editing && <button className="btn ghost" onClick={cancel}>Cancel</button>}<button className="btn primary" id="jSave" disabled={!text.trim() || busy} onClick={save}>{editing ? 'Save changes' : 'Save entry'}</button></span></div>
      <div className="live-wrap"><Live text={text} pick={pick} setPick={setPick} /></div>
    </div>
  </div>;
}
