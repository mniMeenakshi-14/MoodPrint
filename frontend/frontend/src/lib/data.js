// Pure helpers over a student's (decrypted) data. No DOM, no React.
import Emotion from './emotion.js';
import { avg, DAY, startOfDay } from './util.js';
const EMO = Emotion.EMO;

export const moodOf = e => e.userEmotion || e.emo.primary;
export const scoreOf = p => Math.round(EMO[p.emotion].v * p.intensity);

export function points(d) {
  return [...(d.entries || []).map(e => ({ ts: e.ts, emotion: moodOf(e), intensity: e.emo.intensity, corrected: !!e.userEmotion, kind: 'entry', id: e.id })),
    ...(d.checkins || []).map(c => ({ ts: c.ts, emotion: c.mood, intensity: c.intensity * 20, kind: 'checkin', id: c.id }))].sort((a, b) => a.ts - b.ts);
}
export function daily(pts, range) {
  const end = startOfDay(Date.now());
  return Array.from({ length: range }, (_, i) => {
    const t = end - (range - 1 - i) * DAY, L = pts.filter(p => p.ts >= t && p.ts < t + DAY);
    const c = {}; L.forEach(p => { c[p.emotion] = (c[p.emotion] || 0) + 1; });
    return { ts: t, n: L.length, score: L.length ? Math.round(avg(L.map(scoreOf))) : 0, top: Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral' };
  });
}
export function trendOf(pts) {
  const now = Date.now(), a = pts.filter(p => p.ts >= now - 7 * DAY), b = pts.filter(p => p.ts < now - 7 * DAY && p.ts >= now - 14 * DAY);
  if (!a.length || !b.length) return 'not enough data';
  const diff = avg(a.map(scoreOf)) - avg(b.map(scoreOf));
  return diff > 15 ? 'improving' : diff < -15 ? 'heavier' : 'steady';
}
export function streak(checkins) {
  const days = new Set(checkins.map(c => c.day)); let n = 0, t = startOfDay(Date.now());
  const key = ts => { const x = new Date(ts); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  if (!days.has(key(t))) t -= DAY;
  while (days.has(key(t))) { n++; t -= DAY; }
  return n;
}

// Anonymised summary a student can choose to share (never journal text)
export function buildSnapshot(d, scope) {
  const pts = points(d).filter(p => p.ts >= Date.now() - 30 * DAY), snap = { period: 'Last 30 days', updated: Date.now(), records: pts.length };
  if (scope.summary) {
    const c = {}; pts.forEach(p => { c[p.emotion] = (c[p.emotion] || 0) + 1; });
    snap.emotions = Object.entries(c).sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }));
    snap.avg_intensity = Math.round(avg(pts.map(p => p.intensity)));
    snap.negative_pct = pts.length ? Math.round(pts.filter(p => EMO[p.emotion].v < 0).length / pts.length * 100) : 0;
  }
  if (scope.trend) snap.trend = { direction: trendOf(pts), weekly: [3, 2, 1, 0].map(w => { const L = pts.filter(p => p.ts >= Date.now() - (w + 1) * 7 * DAY && p.ts < Date.now() - w * 7 * DAY); return L.length ? Math.round(avg(L.map(scoreOf))) : null; }) };
  if (scope.checkins) { const C = (d.checkins || []).filter(c => c.ts >= Date.now() - 30 * DAY); snap.checkins = { count: C.length, avg_energy: C.length ? +avg(C.map(c => c.energy)).toFixed(1) : null, avg_sleep: C.length ? +avg(C.map(c => c.sleep)).toFixed(1) : null }; }
  if (scope.topics) { const t = {}; (d.entries || []).filter(e => e.ts >= Date.now() - 30 * DAY).forEach(e => e.emo.topics.forEach(x => { t[x] = (t[x] || 0) + 1; })); snap.topics = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([x]) => x); }
  if (scope.alerts) {
    let run = 0, best = 0; pts.forEach(p => { run = EMO[p.emotion].v < 0 && p.intensity >= 60 ? run + 1 : 0; best = Math.max(best, run); });
    snap.alerts = { sustained_heavy: best >= 3, distress_recent: (d.entries || []).some(e => e.emo.support && e.ts >= Date.now() - 7 * DAY) };
  }
  return snap;
}

export function priorityOf(req, share) {
  let s = req.urgency === 'high' ? 3 : req.urgency === 'medium' ? 1 : 0;
  const a = share && share.snapshot && share.snapshot.alerts;
  if (a && a.distress_recent) s += 3;
  if (a && a.sustained_heavy) s += 2;
  if (share && share.snapshot && share.snapshot.trend && share.snapshot.trend.direction === 'heavier') s += 1;
  return s >= 3 ? 'High' : s >= 1 ? 'Medium' : 'Low';
}

// Insights as strings; **text** marks bold parts
export function patternInsights(d) {
  const E = d.entries || [], out = [];
  const byTopic = {}; E.forEach(e => e.emo.topics.forEach(t => (byTopic[t] = byTopic[t] || []).push(moodOf(e))));
  Object.entries(byTopic).filter(([, l]) => l.length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 3).forEach(([t, l]) => {
    const c = {}; l.forEach(k => { c[k] = (c[k] || 0) + 1; }); const [k, n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    if (n >= 2) out.push(`When you write about **${t}**, you most often feel ${EMO[k].emoji} **${EMO[k].label}** (${n} of ${l.length} entries).`);
  });
  const pairs = {}; E.forEach(e => (e.emo.secondaries || []).forEach(s => { if (moodOf(e) !== s) { const key = moodOf(e) + '|' + s; pairs[key] = (pairs[key] || 0) + 1; } }));
  const tp = Object.entries(pairs).sort((a, b) => b[1] - a[1])[0];
  if (tp && tp[1] >= 2) { const [a, b] = tp[0].split('|'); out.push(`${EMO[a].emoji} ${EMO[a].noun[0].toUpperCase() + EMO[a].noun.slice(1)} often comes with ${EMO[b].emoji} ${EMO[b].noun} (${tp[1]} entries).`); }
  const P = points(d), buckets = { morning: [], afternoon: [], evening: [], night: [] };
  P.forEach(p => { const h = new Date(p.ts).getHours(); buckets[h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 22 ? 'evening' : 'night'].push(scoreOf(p)); });
  const bs = Object.entries(buckets).filter(([, l]) => l.length >= 2).map(([k, l]) => [k, avg(l)]).sort((a, b) => a[1] - b[1]);
  if (bs.length >= 2 && bs[0][1] < 0) out.push(`Your heaviest moods tend to show up in the **${bs[0][0]}**, and the lightest in the **${bs[bs.length - 1][0]}**.`);
  if (P.length >= 4) out.push(`${Math.round(P.filter(p => EMO[p.emotion].v > 0).length / P.length * 100)}% of your recorded moods were positive, ${Math.round(P.filter(p => EMO[p.emotion].v < 0).length / P.length * 100)}% were heavier.`);
  return out;
}

export const SCOPE = {
  summary: ['Mood summary', 'Which emotions you felt and how strongly (counts only)'],
  trend: ['Mood trend', 'Whether things are improving, steady or heavier, week by week'],
  checkins: ['Check-in averages', 'Average energy and sleep from daily check-ins'],
  topics: ['Common topics', 'What your entries are often about, e.g. Studies, Sleep'],
  alerts: ['Wellbeing alerts', 'A flag if things have felt very heavy, so they can prioritise you']
};
export const URG = { low: 'I\'d like to talk', medium: 'I\'m struggling', high: 'I need help soon' };
export const TOPICS = ['Academic stress', 'Loneliness', 'Anxiety', 'Relationships', 'Family', 'Sleep', 'Something else'];
