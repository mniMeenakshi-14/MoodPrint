// Page registry + navigation tree
import Overview from './student/Overview.jsx';
import Checkin from './student/Checkin.jsx';
import Journal from './student/Journal.jsx';
import Analysis from './student/Analysis.jsx';
import History from './student/History.jsx';
import Patterns from './student/Patterns.jsx';
import Support from './student/Support.jsx';
import VaultPage from './student/Vault.jsx';
import Profile from './Profile.jsx';
import { Dashboard, Requests, Students, Analytics, Messages, Followups } from './counsellor/Pages.jsx';

const greet = u => { const h = new Date().getHours(); return (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ', ' + u.name.split(' ')[0] + '. Here\'s how today looks.'; };

export const PAGES = {
  overview: { title: 'Overview', icon: '🏠', sub: greet, Component: Overview },
  checkin: { title: 'Daily check-in', icon: '☀️', sub: 'A quick snapshot of today, encrypted like your journal', Component: Checkin },
  journal: { title: 'Journal', icon: '📓', sub: 'Write freely. Everything is encrypted before it leaves this device.', Component: Journal },
  analysis: { title: 'Mood analysis', icon: '🧠', sub: 'What MoodPrint detected, why, and your corrections', Component: Analysis },
  history: { title: 'Mood history', icon: '📈', sub: 'Your moods over time, from journal entries (●) and check-ins (■)', Component: History },
  patterns: { title: 'Patterns', icon: '🧩', sub: 'Emotion distribution, triggers and how things are changing', Component: Patterns },
  support: { title: 'Counsellor support', icon: '💬', sub: 'Reach out, talk, book a time, and control what you share', Component: Support },
  vault: { title: 'Privacy vault', icon: '🔐', sub: 'Your encryption, privacy settings and consent', Component: VaultPage },
  profile: { title: 'Profile', icon: '👤', sub: 'Your details and preferences', Component: Profile },
  'c-dash': { title: 'Dashboard', icon: '📊', sub: u => 'Welcome, ' + u.name + '. Here\'s who needs support.', Component: Dashboard },
  'c-requests': { title: 'Requests', icon: '📥', sub: 'Students asking for support, highest priority first', Component: Requests },
  'c-students': { title: 'Students', icon: '🎓', sub: 'Mood summaries appear only with the student\'s consent', Component: Students },
  'c-analytics': { title: 'Shared analytics', icon: '📈', sub: 'Combined view of summaries students chose to share', Component: Analytics },
  'c-messages': { title: 'Messages', icon: '💬', sub: 'Conversations with students', Component: Messages },
  'c-followups': { title: 'Follow-ups', icon: '🗓️', sub: 'Plan and track check-ins with students', Component: Followups }
};

export const NAV = {
  student: [['Student', ['overview', 'checkin', 'journal', 'analysis', 'history', 'patterns', 'support', 'vault']], ['Settings', ['profile']]],
  counsellor: [['Counsellor portal', ['c-dash', 'c-requests', 'c-students', 'c-analytics', 'c-messages', 'c-followups']], ['Settings', ['profile']]]
};
