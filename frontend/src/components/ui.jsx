// Small shared building blocks
import { useEffect, useRef, useState } from 'react';
import Emotion from '../lib/emotion.js';
import Charts from '../lib/charts.js';
import { ago, plural } from '../lib/util.js';

export const EMO = Emotion.EMO;

export function EmoChip({ k, extra = '' }) {
  const m = EMO[k] || EMO.neutral;
  return <span className="echip" style={{ '--c': m.color }}>{m.emoji} {m.label}{extra}</span>;
}
export function IBar({ v, color }) {
  return <><span className="ibar"><i style={{ width: v + '%', background: color }} /></span><b>{v}/100</b></>;
}
export const Conf = ({ c, suffix = '' }) => <span className={'conf c-' + c.toLowerCase()}>{c}{suffix}</span>;
const ST = { pending: 'Pending', active: 'Active', closed: 'Closed', declined: 'Declined', requested: 'Requested', confirmed: 'Confirmed' };
export const Status = ({ s }) => <span className={'st st-' + s}>{ST[s] || s}</span>;
export const Priority = ({ p }) => <span className={'pr pr-' + p.toLowerCase()}>{p} priority</span>;
export const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
export const Avatar = ({ name, lg }) => <span className={'avatar' + (lg ? ' lg' : '')}>{initials(name)}</span>;

// renders "**bold**" segments
export const Rich = ({ text }) => <>{text.split('**').map((t, i) => i % 2 ? <b key={i}>{t}</b> : <span key={i}>{t}</span>)}</>;

// emotion picker; ai = the AI's suggestion (tagged)
export function Picker({ value, ai, onPick }) {
  return <div className="picker">{Emotion.KEYS.map(k => (
    <button type="button" key={k} data-emo={k} className={'pk' + (k === value ? ' on' : '')} style={{ '--c': EMO[k].color }} onClick={() => onPick(k)}>
      {EMO[k].emoji} {EMO[k].label}{k === ai && <small> AI</small>}
    </button>))}</div>;
}

// a chart area: draw(el) is called with the element (charts redraw on resize themselves)
export function Fig({ draw, height = 240, deps = [] }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) draw(ref.current); /* eslint-disable-next-line */ }, deps);
  return <div className="fig" ref={ref} style={{ height }}><svg /></div>;
}
// donut / sparkline produce SVG markup from fixed labels and numbers
export const Donut = ({ counts }) => <div dangerouslySetInnerHTML={{ __html: Charts.donut(counts) }} />;
export const Spark = ({ vals, color }) => <span className="sparkwrap" dangerouslySetInnerHTML={{ __html: Charts.spark(vals, color) }} />;
export const Legend = ({ keys }) => <div className="legend" dangerouslySetInnerHTML={{ __html: Charts.legend(keys) }} />;

export function Toast({ msg }) {
  const [show, setShow] = useState(false);
  useEffect(() => { if (!msg) return; setShow(true); const t = setTimeout(() => setShow(false), 2800); return () => clearTimeout(t); }, [msg]);
  return <div className={'toast' + (show ? ' show' : '')} role="status">{msg?.m}</div>;
}

// two-tap confirm button
export function ConfirmBtn({ onConfirm, children, confirmText = 'Confirm', className = 'btn ghost xs' }) {
  const [arm, setArm] = useState(false);
  return <button type="button" className={className + (arm ? ' danger' : '')} onClick={() => arm ? onConfirm() : setArm(true)}>{arm ? confirmText : children}</button>;
}

// anonymised summary as a student shares it / a counsellor sees it
export function Snapshot({ s }) {
  if (!s) return <p className="muted small">No data.</p>;
  const max = s.emotions ? Math.max(1, ...s.emotions.map(e => e.count)) : 1;
  const dirCls = x => x === 'heavier' ? 'down' : x === 'improving' ? 'up' : '';
  return <div className="snap">
    <p className="small muted">{s.period} · {plural(s.records, 'record')} · updated {ago(s.updated)}</p>
    {s.emotions && <>
      <div className="kv"><span>Average intensity</span><b>{s.avg_intensity}/100</b><span>Heavier moods</span><b>{s.negative_pct}%</b></div>
      {s.emotions.slice(0, 6).map(e => <div className="brow" key={e.key}><span>{EMO[e.key].emoji} {EMO[e.key].label}</span><div className="btrack"><i style={{ width: e.count / max * 100 + '%', background: EMO[e.key].color }} /></div><span className="num">{e.count}</span></div>)}
    </>}
    {s.trend && <><div className="kv"><span>Trend</span><b className={dirCls(s.trend.direction)}>{s.trend.direction}</b></div>
      <div className="sparkwrap"><Spark vals={s.trend.weekly} /><small className="muted">4 weeks →</small></div></>}
    {s.checkins && <div className="kv"><span>Check-ins</span><b>{s.checkins.count}</b><span>Avg energy</span><b>{s.checkins.avg_energy ?? '–'}/5</b><span>Avg sleep</span><b>{s.checkins.avg_sleep ?? '–'} h</b></div>}
    {s.topics && <div className="kv"><span>Often about</span><b>{s.topics.join(', ') || 'None'}</b></div>}
    {s.alerts && <div className="kv"><span>Wellbeing alert</span><b className={s.alerts.distress_recent || s.alerts.sustained_heavy ? 'down' : ''}>{s.alerts.distress_recent ? 'Recent entry flagged for support' : s.alerts.sustained_heavy ? 'Several heavy days in a row' : 'None'}</b></div>}
  </div>;
}

export const Empty = ({ children }) => <p className="empty">{children}</p>;
