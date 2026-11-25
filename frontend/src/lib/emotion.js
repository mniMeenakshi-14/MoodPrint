// ============================================================
// ON-DEVICE EMOTION ANALYSIS (prototype)
// A keyword + rules model that runs entirely in the browser.
// It is NOT a trained AI model: it matches emotion words and
// phrases, then adjusts for intensifiers ("very"), softeners
// ("a bit"), negation ("not happy") and exclamation marks.
// Output: primary + secondary emotion, intensity 0-100,
// confidence, and a plain-language explanation.
// ============================================================
const Emotion = (() => {
  // label, emoji, colour, valence (+1 lighter / -1 heavier), noun for explanations
  const EMO = {
    happy:     { label: 'Happy',     emoji: '😊', color: '#ffd166', v: 1,    noun: 'happiness' },
    excited:   { label: 'Excited',   emoji: '🤩', color: '#ff9f43', v: 1,    noun: 'excitement' },
    hopeful:   { label: 'Hopeful',   emoji: '🌱', color: '#34d399', v: 1,    noun: 'hope' },
    calm:      { label: 'Calm',      emoji: '😌', color: '#67e8f9', v: 1,    noun: 'calm' },
    sad:       { label: 'Sad',       emoji: '😢', color: '#60a5fa', v: -1,   noun: 'sadness' },
    lonely:    { label: 'Lonely',    emoji: '🥺', color: '#818cf8', v: -1,   noun: 'loneliness' },
    anxious:   { label: 'Anxious',   emoji: '😰', color: '#f472b6', v: -1,   noun: 'anxiety' },
    fear:      { label: 'Afraid',    emoji: '😨', color: '#d946ef', v: -1,   noun: 'fear' },
    stressed:  { label: 'Stressed',  emoji: '😣', color: '#fb7185', v: -1,   noun: 'stress' },
    angry:     { label: 'Angry',     emoji: '😠', color: '#ef4444', v: -1,   noun: 'anger' },
    confused:  { label: 'Confused',  emoji: '😕', color: '#a3e635', v: -0.5, noun: 'confusion' },
    exhausted: { label: 'Exhausted', emoji: '😴', color: '#94a3b8', v: -1,   noun: 'exhaustion' },
    neutral:   { label: 'Neutral',   emoji: '😐', color: '#64748b', v: 0,    noun: 'a steady tone' }
  };

  // word -> [emotion, weight, theme (optional, used in the explanation)]
  const W = {};
  const add = (emo, list) => list.forEach(([w, wt, th]) => { W[w] = [emo, wt, th]; });
  add('sad', [['sad', 2.5], ['sadness', 2.5], ['unhappy', 2.2], ['cry', 2.2], ['cried', 2.2], ['crying', 2.4], ['tears', 2],
    ['depressed', 3], ['heartbroken', 3, 'heartbreak'], ['miserable', 3], ['upset', 2], ['hurt', 2, 'hurt'], ['disappointed', 2.2, 'disappointment'],
    ['hopeless', 3, 'hopelessness'], ['empty', 1.6], ['broken', 2.4], ['saddened', 2.4], ['heartbreaking', 2.6, 'heartbreak'], ['devastated', 3.2], ['grief', 3, 'grief'], ['lonesome', 2], ['gloomy', 2], ['failure', 2.4, 'self-doubt'], ['worthless', 3, 'self-doubt'], ['useless', 2.2, 'self-doubt'], ['stupid', 1.8, 'self-doubt'], ['missed', 1.2, 'disappointment']]);
  add('lonely', [['lonely', 3], ['loneliness', 3], ['alone', 2], ['isolated', 2.6], ['ignored', 2.2, 'exclusion'], ['excluded', 2.6, 'exclusion'],
    ['nobody', 1.6], ['homesick', 2.6, 'missing home']]);
  add('angry', [['angry', 3], ['anger', 3], ['mad', 2], ['furious', 3.2], ['annoyed', 2], ['irritated', 2.2], ['frustrated', 2.4, 'frustration'],
    ['frustrating', 2.2, 'frustration'], ['hate', 2.6], ['unfair', 2.2, 'unfairness'], ['rage', 3.2], ['shouted', 1.6, 'conflict'], ['fight', 1.6, 'conflict'], ['argued', 1.6, 'conflict']]);
  add('anxious', [['anxious', 3], ['anxiety', 3], ['nervous', 2.4], ['worried', 2.4, 'worry'], ['worry', 2.2, 'worry'],
    ['panic', 3], ['overthinking', 2.4, 'overthinking'], ['uneasy', 2], ['tense', 1.8], ['restless', 1.8]]);
  add('fear', [['scared', 2.6], ['afraid', 2.6], ['fear', 2.6], ['terrified', 3.2], ['frightened', 3], ['unsafe', 2.6, 'feeling unsafe'], ['dread', 2.6], ['threatened', 2.8, 'feeling unsafe']]);
  add('confused', [['confused', 2.8], ['confusing', 2.2], ['unsure', 2], ['uncertain', 2.2], ['lost', 1.8], ['torn', 2], ['unclear', 1.8], ['stuck', 1.8, 'feeling stuck'], ['clueless', 2.2]]);
  add('stressed', [['stressed', 3], ['stress', 2.6], ['stressful', 2.6], ['pressure', 2, 'pressure'], ['overwhelmed', 2.8, 'overwhelm'],
    ['deadline', 1.2, 'academic pressure'], ['deadlines', 1.4, 'academic pressure'], ['exam', 1, 'academic pressure'], ['exams', 1.2, 'academic pressure'],
    ['internals', 1.2, 'academic pressure'], ['assignment', 0.8, 'academic pressure'], ['assignments', 1.2, 'academic pressure'], ['burnout', 3, 'burnout'], ['hectic', 1.8]]);
  add('exhausted', [['tired', 2.4], ['exhausted', 2.8], ['exhausting', 2.2], ['sleepy', 2], ['drained', 2.6], ['fatigue', 2.5], ['insomnia', 2.6, 'poor sleep']]);
  add('happy', [['happy', 2.8], ['happier', 2.4], ['glad', 2.2], ['joy', 2.8], ['great', 2], ['good', 1.3], ['amazing', 2.6], ['awesome', 2.6],
    ['wonderful', 2.6], ['fun', 2, 'fun'], ['laughed', 2.2, 'laughter'], ['laugh', 2, 'laughter'], ['smile', 1.6], ['smiled', 1.6], ['love', 2.2, 'love'],
    ['loved', 2.4, 'feeling loved'], ['proud', 2.6, 'pride'], ['passed', 1.6, 'achievement'], ['won', 2.4, 'achievement'],
    ['nice', 1.4], ['best', 2], ['grateful', 2.6, 'gratitude'], ['thankful', 2.6, 'gratitude'], ['blessed', 2.4, 'gratitude'], ['appreciate', 2, 'gratitude'], ['lucky', 1.8]]);
  add('hopeful', [['hopeful', 3], ['hope', 1.8], ['optimistic', 3], ['motivated', 2.4, 'motivation'], ['confident', 2.4, 'confidence'], ['determined', 2.4, 'determination'], ['better', 1.4, 'improvement'], ['improving', 2, 'improvement']]);
  add('excited', [['excited', 3], ['exciting', 2.6], ['thrilled', 3], ['yay', 2.2], ['pumped', 2.4], ['ecstatic', 3.2]]);
  add('calm', [['calm', 2.6], ['peaceful', 2.8], ['relaxed', 2.6], ['relieved', 2.6, 'relief'], ['relief', 2.4, 'relief'], ['fresh', 1.6],
    ['rested', 2, 'rest'], ['content', 2], ['okay', 0.8], ['ok', 0.8], ['fine', 0.8], ['steady', 1.2]]);

  // multi-word phrases (checked on the whole text)
  const P = [
    [/\bwithout me\b/, 'lonely', 2.2, 'exclusion'], [/\bleft out\b/, 'lonely', 2.6, 'exclusion'], [/\bno one\b/, 'lonely', 1.6],
    [/\bmiss (?:my|home|them|her|him)\b/, 'lonely', 1.8, 'missing someone'], [/\bwant to cry\b/, 'sad', 1, 'sadness'],
    [/\bfeel(?:ing)? (?:low|down)\b/, 'sad', 2.2], [/\b(?:can'?t|couldn'?t|could not|cannot) sleep\b/, 'exhausted', 2.4, 'poor sleep'],
    [/\btoo much\b/, 'stressed', 1.6, 'overwhelm'], [/\b(?:can'?t|cannot) wait\b/, 'excited', 2.4], [/\bgave up\b/, 'sad', 2, 'hopelessness'],
    [/\bwithout asking\b/, 'angry', 1.6, 'disrespect'], [/\bnot (?:ok|okay|fine|good)\b/, 'sad', 2.4], [/\bfeel(?:ing)? (?:bad|terrible|awful)\b/, 'sad', 2.4],
    [/\b(?:don'?t|do not) know what to do\b/, 'confused', 2.6, 'uncertainty'], [/\bmixed feelings\b/, 'confused', 2.4], [/\bnothing matters\b/, 'sad', 2.6, 'hopelessness'], [/\blooking forward\b/, 'hopeful', 2.4, 'anticipation'],
    [/\b(?:will|going to) (?:get|be) better\b/, 'hopeful', 2.6, 'hope'], [/\bburnt? out\b/, 'exhausted', 2.8, 'burnout'], [/\bfreaking out\b/, 'anxious', 2.6]
  ];
  const SUPPORT = /\b(kill myself|killing myself|better off dead|cut myself|cutting myself|end my life|want to die|wanna die|suicid\w*|hurt myself|self[- ]?harm|no reason to live|don'?t want to (?:live|be alive))\b/i;

  const UP = { very: 1.4, really: 1.4, so: 1.35, extremely: 1.6, super: 1.4, too: 1.25, totally: 1.4, completely: 1.45, deeply: 1.45, terribly: 1.5, incredibly: 1.5, absolutely: 1.4 };
  const DOWN = { slightly: 0.6, kinda: 0.65, somewhat: 0.65, little: 0.7, bit: 0.7, barely: 0.5 };
  const NEG = new Set(['not', 'no', 'never', "don't", 'dont', "didn't", 'didnt', "isn't", "wasn't", "won't", "can't", 'cant', 'hardly', "aren't", "doesn't", 'without']);

  const TOPICS = {
    Studies: 'exam exams test tests assignment assignments deadline deadlines marks grade internals viva lab record syllabus study studying results class classes lecture professor project',
    Sleep: 'sleep slept insomnia awake nap sleepy 2am 3am bed',
    Friends: 'friend friends roommate hostel party hangout classmates team',
    Family: 'mom dad amma appa parents family home sister brother',
    Health: 'sick fever headache gym workout walk yoga food ate',
    Money: 'money fees rent expensive budget loan',
    Career: 'placement placements internship interview job resume career hackathon',
    'Screen time': 'instagram reels scrolling scroll youtube screen'
  };
  const TMAP = {}; for (const k in TOPICS) for (const w of TOPICS[k].split(' ')) TMAP[w] = k;

  const list = (xs) => xs.length < 2 ? xs.join('') : xs.length === 2 ? xs.join(' and ') : xs.slice(0, -1).join(', ') + ', and ' + xs[xs.length - 1];

  function analyse(text) {
    const lower = text.toLowerCase().replace(/[’‘]/g, "'");
    const toks = lower.match(/[a-z0-9']+|!/g) || [];
    const words = toks.filter(t => t !== '!');
    const excl = Math.min(toks.length - words.length, 3);
    const scores = {}, themes = [], cues = [], topics = new Set();
    const bump = (emo, w, theme, pos, cue) => {
      scores[emo] = (scores[emo] || 0) + w; cues.push(cue);
      themes.push({ pos, emo, t: theme || EMO[emo].noun });
    };

    words.forEach((w, i) => {
      if (TMAP[w]) topics.add(TMAP[w]);
      const hit = W[w] || W[w.replace(/(?:ness|ed|ing|ly|s)$/, '')] || W[w.replace(/(?:ed|ing)$/, 'e')]; if (!hit) return;
      let [emo, wt, theme] = hit, mult = 1;
      for (let k = 1; k <= 2; k++) { const p = words[i - k]; if (!p) break; if (UP[p]) mult *= UP[p]; if (DOWN[p]) mult *= DOWN[p]; }
      const win = words.slice(Math.max(0, i - 3), i);
      const negated = win.some(p => NEG.has(p)) && !win.includes('stop');   // "can't stop overthinking" is not a negation
      if (negated) {
        // "not happy" leans sad; "not sad" leans calm
        if (EMO[emo].v > 0) bump('sad', wt * 0.6, null, i, 'not ' + w);
        else scores.calm = (scores.calm || 0) + wt * 0.3;
        return;
      }
      bump(emo, wt * mult, theme, i, w);
    });
    P.forEach(([re, emo, wt, theme]) => {
      const m = lower.match(re); if (!m) return;
      const pos = (lower.slice(0, m.index).match(/[a-z0-9']+/g) || []).length;
      bump(emo, wt, theme, pos, m[0]);
    });
    if (SUPPORT.test(lower)) bump('sad', 3.5, 'deep distress', 0, 'distress');
    if (excl) for (const k in scores) scores[k] *= 1 + 0.08 * excl;

    const ranked = Object.entries(scores).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
    const support = SUPPORT.test(lower);
    const nWords = words.length;

    if (!ranked.length || ranked[0][1] < 0.75) {
      return {
        primary: 'neutral', secondary: null, secondaries: [], breakdown: [], intensity: nWords ? Math.min(20, 5 + nWords) : 0,
        confidence: nWords >= 6 ? 'Medium' : 'Low', cues: [], topics: [...topics], support, words: nWords,
        explanation: nWords ? 'No strong emotion words stood out, so this reads as a steady, neutral entry.' : ''
      };
    }
    const [p, ps] = ranked[0];
    const secs = ranked.slice(1, 3).filter(([, sc]) => sc >= Math.max(1, ps * 0.3));
    const second = secs[0] || null;
    const raw = ps + secs.reduce((t, [, sc], i) => t + sc * (i ? 0.3 : 0.6), 0);
    const intensity = Math.max(10, Math.min(98, Math.round(100 * (1 - Math.exp(-raw / 4.5)))));
    const confidence = cues.length >= 3 && ps >= 4 ? 'High' : (cues.length >= 2 || ps >= 2.5) ? 'Medium' : 'Low';

    // explanation: themes of the top emotions, in the order they appear
    const keep = new Set([p, ...secs.map(x => x[0])]);
    themes.sort((a, b) => a.pos - b.pos);
    const relevant = [];
    themes.forEach(({ emo, t }) => { if (keep.has(emo) && !relevant.includes(t)) relevant.push(t); });
    const parts = (relevant.length ? relevant : [EMO[p].noun]).slice(0, 3);
    if (!parts.includes(EMO[p].noun)) parts.unshift(EMO[p].noun), parts.length = Math.min(parts.length, 3);

    const tot = ranked.reduce((t, [, sc]) => t + sc, 0);
    return {
      primary: p, secondary: second ? second[0] : null, secondaries: secs.map(x => x[0]), intensity, confidence,
      breakdown: ranked.slice(0, 5).map(([k, sc]) => ({ k, pct: Math.round(sc / tot * 100) })),
      explanation: 'Your entry expresses ' + list(parts) + '.',
      cues: [...new Set(cues)], topics: [...topics], support, words: nWords
    };
  }

  return { EMO, analyse, KEYS: Object.keys(EMO), TOPIC_NAMES: Object.keys(TOPICS) };
})();

export default Emotion;
