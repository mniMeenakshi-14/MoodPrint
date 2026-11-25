import { useApp } from '../../store.jsx';
import { EMO, EmoChip, IBar, Conf, Picker, Rich } from '../../components/ui.jsx';
import { moodOf, patternInsights } from '../../lib/data.js';
import { fmtDateTime, plural } from '../../lib/util.js';

export default function Analysis() {
  const { d, ui, setUi, go, correctEntry, toast } = useApp();
  const E = [...d.entries].reverse();
  if (!E.length) return <div className="glass card"><p className="empty">Write a journal entry to see its emotion analysis.</p><button className="btn primary" onClick={() => go('journal')}>Write an entry</button></div>;
  const e = E.find(x => x.id === ui.anId) || E[0], a = e.emo, k = moodOf(e), m = EMO[k], ins = patternInsights(d);

  async function fix(x) {
    const u = await correctEntry(e.id, x);
    toast(u ? 'Updated to ' + EMO[x].label + '. Your graphs now use it.' : 'Back to the AI\'s suggestion.');
  }
  return <>
    <div className="glass card"><label htmlFor="anSel">Entry</label>
      <select id="anSel" value={e.id} onChange={ev => setUi({ anId: ev.target.value })}>{E.map(x => <option key={x.id} value={x.id}>{fmtDateTime(x.ts)} · {EMO[moodOf(x)].emoji} {EMO[moodOf(x)].label}</option>)}</select></div>
    <div className="grid2" style={{ marginTop: 18 }}>
      <div className="glass card">
        <div className="emo-main"><span className="big-emo">{m.emoji}</span><div><span className="small muted">Primary emotion{e.userEmotion ? ' (corrected by you)' : ''}</span><h2 className="emo-label" style={{ color: m.color }}>{m.label}</h2></div></div>
        <dl className="facts">
          <dt>Secondary emotions</dt><dd>{a.secondaries.length ? a.secondaries.map(s => <EmoChip key={s} k={s} />) : 'None detected'}</dd>
          <dt>Mood intensity</dt><dd className="irow"><IBar v={a.intensity} color={m.color} /></dd>
          <dt>Confidence</dt><dd><Conf c={a.confidence} /> <span className="small muted">based on {plural(a.cues.length, 'emotion cue')}</span></dd>
          {e.userEmotion && <><dt>AI suggested</dt><dd><EmoChip k={a.primary} /></dd></>}
        </dl>
        <p className="explain">{a.explanation}</p>
        {a.cues.length > 0 && <><p className="small muted">Why: these words and phrases signalled emotion</p><div className="row wrap">{a.cues.map(c => <span className="chip" key={c}>“{c}”</span>)}</div></>}
        {a.topics.length > 0 && <><p className="small muted" style={{ marginTop: 12 }}>Related to</p><div className="row wrap">{a.topics.map(t => <span className="chip" key={t}>{t}</span>)}</div></>}
        <p className="proto">Prototype: a keyword-based emotion model running in your browser, not a trained AI model.</p>
      </div>
      <div className="glass card">
        <h3>Is this right?</h3>
        <p className="small muted">If the AI got it wrong, pick how you actually felt. Your choice is saved (encrypted) with this entry, and your graphs and patterns use it.</p>
        <Picker value={k} ai={a.primary} onPick={fix} />
        <h3 style={{ marginTop: 22 }}>Your emotional patterns</h3>
        {ins.length ? <ul className="ins">{ins.map((t, i) => <li key={i}><Rich text={t} /></li>)}</ul> : <p className="muted small">Patterns appear after a few entries.</p>}
      </div>
    </div>
  </>;
}
