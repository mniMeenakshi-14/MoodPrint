// Demo campus: 3 students + 1 counsellor with sample data.
// Every student's entries are really encrypted with their own key.
import API from './api.js';
import Vault from './vault.js';
import Emotion from './emotion.js';
import { DAY, dayKey } from './util.js';
import { buildSnapshot } from './data.js';
export const DEMO = {
  counsellor: { username: 'dr.rao', name: 'Dr. Priya Rao', pass: 'counsellor-demo', profile: { title: 'Campus counsellor' } },
  pass: 'student-demo',
  students: [
    { username: 'diya', name: 'Diya Sharma', profile: { course: 'B.E. CSE, 2nd year', pronouns: 'she/her' },
      entries: [[18, 20, "First week back at the hostel. So excited to see everyone again!"], [16, 18, "Group project meeting went well, I feel hopeful about this semester."],
        [14, 21, "Long day of labs. Pretty tired but okay."], [12, 22, "My roommate moved to another room. The room feels empty and I feel a bit lonely."],
        [10, 21, "Everyone went for dinner without me. I feel left out and sad."], [8, 23, "Couldn't sleep, kept thinking about home. Homesick and exhausted."],
        [6, 19, "Talked to amma on the phone, felt calm for a while."], [4, 22, "I feel very sad today. My friends went out without me and I feel lonely. I just want to cry."],
        [3, 23, "Nobody replied in the group chat. Feeling invisible and alone."], [2, 20, "Tried to focus on assignments but I feel lost and unsure about everything."],
        [1, 22, "Not okay today. Everything feels heavy and I feel so alone."]],
      checkins: [[6, 'calm', 2, 3, 7], [5, 'lonely', 3, 2, 6], [4, 'sad', 4, 2, 5], [3, 'lonely', 4, 2, 5], [2, 'confused', 3, 2, 6], [1, 'sad', 4, 1, 5]],
      request: { topic: 'Loneliness', urgency: 'medium', ago: 1, message: "Hi, I've been feeling really lonely at the hostel lately and it's getting harder to focus. Could we talk?" },
      share: { summary: true, trend: true, checkins: true, topics: true, alerts: true } },
    { username: 'aarav', name: 'Aarav Menon', profile: { course: 'B.E. ISE, 3rd year', pronouns: 'he/him' },
      entries: [[15, 10, "Internals timetable is out. Already feeling the pressure."], [13, 21, "Three assignments due this week. Overwhelmed and stressed."],
        [11, 23, "Placement test tomorrow, I'm nervous and can't stop overthinking."], [10, 17, "Test went better than expected, so relieved!"],
        [8, 2, "Pulled an all-nighter for the DBMS record. Completely exhausted."], [6, 18, "My teammate didn't do his part and I'm so angry and frustrated."],
        [4, 22, "Exams in two days, I'm anxious and scared I'll fail."], [3, 16, "Studied with friends, felt a bit more confident."],
        [1, 15, "Exam done. Not sure how it went, feeling confused but hopeful."]],
      checkins: [[5, 'stressed', 4, 2, 5], [4, 'anxious', 4, 2, 5], [3, 'stressed', 3, 3, 6], [2, 'exhausted', 3, 2, 5], [1, 'hopeful', 3, 3, 7]],
      request: { topic: 'Academic stress', urgency: 'low', ago: 5, message: "Exam stress is getting to me. I'd like some tips on managing it." },
      share: { summary: true, trend: true } },
    { username: 'kabir', name: 'Kabir Khan', profile: { course: 'B.E. Mech, 1st year' },
      entries: [[14, 19, "Won the inter-college football match! So excited!"], [11, 11, "Calm weekend, read a book and went for a walk."],
        [9, 20, "Bit stressed about the hackathon deadline."], [7, 18, "Hackathon went great, we won second place! Proud of the team."],
        [4, 21, "Grateful for my friends, we laughed so much at dinner."], [2, 17, "Looking forward to the trip next week, feeling hopeful and happy."]],
      checkins: [[3, 'happy', 3, 4, 8], [2, 'calm', 3, 4, 7], [1, 'hopeful', 4, 4, 8]] }
  ]
};
const at = (daysAgo, hour) => { const d = new Date(Date.now() - daysAgo * DAY); d.setHours(hour, (daysAgo * 7) % 60, 0, 0); return d.getTime(); };

export async function seedDemo(note) {
  if (await API.lookup('diya')) return false;
  let salt, v; const made = [];
  for (const st of DEMO.students) {
    note('Creating ' + st.name + ' and encrypting their journal…');
    salt = Vault.newSalt(); v = await Vault.unlock(DEMO.pass, salt, Vault.ITER);
    const me = await API.register({ role: 'student', username: st.username, name: st.name, profile: st.profile, salt, iterations: Vault.ITER, login_verifier: v });
    const sd = { entries: [], checkins: [] };   // this student's data, for their summary
    for (const [d, h, text] of st.entries) {
      const emo = Emotion.analyse(text), ts = at(d, h), data = { text, emo, userEmotion: null };
      const sealed = await Vault.seal(data); const row = await API.put('entries', { ts, ...sealed });
      sd.entries.push({ id: row.id, ts, ...sealed, ...data });
    }
    for (const [d, mood, intensity, energy, sleep] of st.checkins) {
      const ts = at(d, 9), data = { mood, intensity, energy, sleep, note: '' }, sealed = await Vault.seal(data);
      const row = await API.put('checkins', { ts, day: dayKey(ts), ...sealed }); sd.checkins.push({ id: row.id, ts, day: dayKey(ts), ...data });
    }
    if (st.share) await API.put('shares', { studentName: st.name, active: true, scope: st.share, snapshot: buildSnapshot(sd, st.share), granted: at(st.request ? st.request.ago : 3, 10), revoked: null });
    if (st.request) {
      const t = at(st.request.ago, 20);
      const r = await API.put('requests', { studentName: st.name, topic: st.request.topic, urgency: st.request.urgency, status: 'pending', counsellor: null, counsellorName: null, created: t, updated: t });
      await API.put('messages', { request: r.id, from: 'student', fromName: st.name, text: st.request.message, ts: t });
      made.push({ st, r });
    }
    Vault.lock(); API.logout();
  }
  Vault.lock(); API.logout();
  return true;
}

