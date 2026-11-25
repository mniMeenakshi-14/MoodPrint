// ============================================================
// ON-DEVICE AI SUPPORT CHAT (prototype)
// Runs entirely in the browser. Uses the emotion model to understand
// a message, then replies with reflection + validation + one gentle
// suggestion + a question. Nothing is sent to the server or stored.
// It is a supportive prototype, not a therapist, and never diagnoses.
// ============================================================
import Emotion from './emotion.js';

const EMO = Emotion.EMO;
const pick = (list, n) => list[n % list.length];

const TIPS = {
  sad: ['Being gentle with yourself matters right now. Even something small, like a warm drink or stepping outside for a few minutes, can help a little.',
    'Sometimes writing down one thing that felt okay today, however tiny, can soften a heavy day.',
    'It can help to tell one person you trust that today is hard. You don\'t have to explain everything.'],
  lonely: ['Reaching out to one person, even with a short "hey, how are you?", can make the distance feel smaller.',
    'Being around people without needing to talk, like a library or common room, can ease loneliness a bit.',
    'Feeling left out hurts. It doesn\'t mean you don\'t matter.'],
  anxious: ['Try a slow breath: in for 4, hold for 4, out for 6. Repeat it a few times.',
    'Writing the worry down and asking "what\'s one small step I can take?" can make it feel more manageable.',
    'Grounding can help: name 5 things you can see, 4 you can hear and 3 you can touch.'],
  fear: ['If you feel unsafe right now, please move somewhere safe and contact someone you trust, or call 112.',
    'Fear makes things feel bigger. Talking it through with someone you trust can help you see it more clearly.',
    'Try a slow breath, in for 4 and out for 6, to help your body settle.'],
  stressed: ['Breaking it into the very next small task, just one, can make a big load feel lighter.',
    'A short break, even 10 minutes away from the screen, often helps you come back clearer.',
    'Listing what\'s due and picking the most important one can turn pressure into a plan.'],
  angry: ['It\'s okay to feel angry. Taking a short walk or a few slow breaths before responding can help.',
    'Writing out exactly what upset you, without sending it, can release some of the pressure.',
    'Anger often points to something that matters to you. What feels unfair here?'],
  confused: ['When things feel unclear, writing down your options, even messy ones, can help.',
    'You don\'t have to decide everything today. What\'s the one thing you need to figure out first?',
    'Talking it through with someone who knows the situation, like a senior, mentor or counsellor, can bring clarity.'],
  exhausted: ['Your body might be asking for rest. Even a short nap or an early night can make a real difference.',
    'Being this tired makes everything feel heavier. Is there anything you can drop or postpone today?',
    'Water, a proper meal and a little sleep are small things that help more than they seem to.'],
  happy: ['That\'s lovely to hear. Noticing what made today good helps you find more of it.',
    'Moments like this are worth holding on to. Maybe write down what made it special.',
    'It\'s great that you\'re feeling this way. Who or what helped today feel good?'],
  excited: ['That sounds exciting! It\'s worth enjoying the moment.',
    'Love the energy! What are you most looking forward to?'],
  hopeful: ['Hope is a strong place to build from. What\'s one small step towards it?',
    'It\'s good to see you looking forward. What helped you feel this way?'],
  calm: ['It\'s good to have a calm moment. Noticing what brought it can help you return to it.',
    'Calm days are worth noticing. What helped today feel steady?'],
  neutral: ['I\'m here to listen. How are you really feeling today?',
    'Tell me a bit more about your day. What\'s been on your mind?',
    'Sometimes it\'s hard to name a feeling. What happened today that stood out?']
};
const ASK = {
  sad: 'Would you like to tell me more about what\'s been making today heavy?',
  lonely: 'Is there someone you feel comfortable reaching out to?',
  anxious: 'What\'s worrying you the most right now?',
  fear: 'Are you safe where you are right now?',
  stressed: 'What\'s the one thing weighing on you most?',
  angry: 'What happened that made you feel this way?',
  confused: 'What part feels most unclear?',
  exhausted: 'How have you been sleeping lately?',
  happy: 'What made today good?', excited: 'What\'s coming up?', hopeful: 'What are you hoping for?', calm: 'What helped?', neutral: ''
};

export const GREETING = 'Hi, I\'m your on-device AI. I run only in this browser, so nothing you type here is sent anywhere or saved. How are you feeling right now?';

export function reply(text, turn = 0) {
  const t = text.trim().toLowerCase();
  if (/^(hi|hello|hey|hii+|good (morning|afternoon|evening))\b/.test(t) && t.split(/\s+/).length <= 4)
    return { text: 'Hi! I\'m glad you\'re here. How are you feeling today?', emotion: 'neutral' };
  if (/\b(thank(s| you)|thx)\b/.test(t) && t.split(/\s+/).length <= 6)
    return { text: 'You\'re welcome. I\'m here whenever you want to talk.', emotion: 'neutral' };

  const a = Emotion.analyse(text);
  if (a.support) {
    return { support: true, emotion: a.primary,
      text: 'I\'m really sorry you\'re feeling this much pain. You deserve support from a real person right now. Please reach out to someone you trust, call Tele-MANAS on 14416 (free, 24×7), or call 112 if you\'re in immediate danger. You can also request your counsellor from this page.' };
  }
  const k = a.primary, m = EMO[k];
  if (k === 'neutral') return { text: pick(TIPS.neutral, turn), emotion: k };
  const feel = a.secondaries.length ? `${m.label.toLowerCase()} and ${EMO[a.secondaries[0]].label.toLowerCase()}` : m.label.toLowerCase();
  const reflect = m.v > 0 ? `It sounds like you're feeling ${feel}.` : `It sounds like you're feeling ${feel}${a.intensity >= 70 ? ', and quite strongly' : ''}. That's completely okay to feel.`;
  return { text: [reflect, pick(TIPS[k], turn), ASK[k]].filter(Boolean).join(' '), emotion: k };
}
