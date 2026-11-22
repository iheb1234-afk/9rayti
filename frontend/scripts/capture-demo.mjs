// Capture les réponses de l'API locale (données de démonstration fraîches) pour le mode démo
// hors-ligne publié sur GitHub Pages. Usage : node scripts/capture-demo.mjs (API lancée sur :3000,
// base remise à zéro juste avant pour que les dates soient « fraîches »).
import { writeFileSync } from 'node:fs';
const API = process.env.API ?? 'http://localhost:3000/api';
const get = async (path, token) => {
  const r = await fetch(API + path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
};
const login = async (email) =>
  (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'demo1234' }) })).json();

const EMAILS = ['yasmine@9rayti.tn', 'omar@9rayti.tn', 'sarra@9rayti.tn', 'youssef@9rayti.tn', 'amira@9rayti.tn', 'mehdi@9rayti.tn', 'nour@9rayti.tn', 'admin@9rayti.tn'];

// ----- Public
const subjects = await get('/subjects');
const stats = await get('/stats');
const latestReviews = await get('/reviews/latest');
const cards = await get('/tutors');
const tutors = {};
for (const c of cards) tutors[c.id] = await get(`/tutors/${c.id}`);

// ----- Par compte
const users = [];
const requests = {};
const classrooms = {};
const credits = {};
const tutorExtra = {};
const favorites = {};
const notifications = {};
const people = {}; // étudiants vus par les tuteurs (y compris ceux qui ne se connectent pas)
const threads = {}; // clé « idÉtudiant|idProfilTuteur »
const sessionsBooked = {};
let tutorSessions = [];

const addThread = (studentId, tutorId, messages, mineRole) => {
  const key = `${studentId}|${tutorId}`;
  const t = (threads[key] ??= { studentId, tutorId, messages: [] });
  for (const m of messages) {
    if (t.messages.some((x) => x.id === m.id)) continue;
    const fromRole = m.mine ? mineRole : mineRole === 'etudiant' ? 'tuteur' : 'etudiant';
    t.messages.push({ id: m.id, fromRole, body: m.body, masked: m.masked, readAt: m.readAt, createdAt: m.createdAt });
  }
  t.messages.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
};

for (const email of EMAILS) {
  const s = await login(email);
  const u = s.user;
  users.push(u);
  // Notifications d'abord (la lecture d'une conversation en crée parfois l'état « lu »).
  notifications[u.id] = (await get('/notifications', s.token)).items;
  if (u.role === 'etudiant') {
    for (const r of await get('/requests/mine', s.token)) {
      requests[r.id] = r;
      if (['acceptee', 'faite', 'versee', 'signalee', 'remboursee'].includes(r.state)) classrooms[r.id] = await get(`/classroom/${r.id}`, s.token);
    }
    credits[u.id] = await get('/credits/me', s.token);
    favorites[u.id] = await get('/favorites/ids', s.token);
    for (const x of await get('/exam-sessions/mine', s.token)) if (x.booked) (sessionsBooked[x.id] ??= []).push(u.id);
    for (const th of await get('/messages', s.token)) {
      const d = await get(`/messages/${th.partner.id}`, s.token);
      addThread(u.id, th.partner.id, d.messages, 'etudiant');
    }
  }
  if (u.role === 'tuteur') {
    for (const r of await get('/tutor/requests', s.token)) requests[r.id] = r;
    let profile = null;
    try {
      profile = await get('/tutor/profile', s.token);
    } catch {
      /* profil absent */
    }
    tutorExtra[u.id] = { slots: await get('/tutor/slots', s.token), rates: await get('/tutor/rates', s.token), profile };
    if (u.tutorStatus === 'valide') tutorSessions = tutorSessions.concat(await get('/tutor/exam-sessions', s.token));
    for (const th of await get('/messages', s.token)) {
      people[th.partner.id] = { firstName: th.partner.name, school: th.partner.school, avatarUrl: th.partner.avatarUrl };
      const d = await get(`/messages/${th.partner.id}`, s.token);
      addThread(th.partner.id, u.tutorProfileId, d.messages, 'tuteur');
    }
  }
}

// ----- Administration
const admin = await login('admin@9rayti.tn');
const pending = await get('/admin/tutors/pending', admin.token);
const reports = await get('/admin/reports', admin.token);
const contacts = await get('/admin/contact', admin.token);
// Toutes les demandes (y compris celles d'étudiants qui ne se connectent pas à la démo).
for (let page = 1, pages = 1; page <= pages; page++) {
  const p = await get(`/admin/requests?page=${page}`, admin.token);
  pages = p.pages;
  for (const r of p.items) requests[r.id] ??= r;
}
for (const r of Object.values(requests)) people[r.student.id] ??= { firstName: r.student.firstName, school: r.student.school, avatarUrl: r.student.avatarUrl ?? null };

// ----- Sessions d'examen (vue tuteur : avec les inscrits)
const examSessions = (await get('/exam-sessions')).map((x) => {
  const own = tutorSessions.find((t) => t.id === x.id);
  return { ...x, booked: false, bookedBy: sessionsBooked[x.id] ?? [], students: own?.students ?? [] };
});

writeFileSync(
  new URL('../src/app/demo/fixture.json', import.meta.url),
  JSON.stringify({ capturedAt: new Date().toISOString(), subjects, stats, latestReviews, tutors, users, people, requests, classrooms, credits, tutorExtra, favorites, notifications, threads, pending, reports: reports.map((r) => r.id), contacts, examSessions }),
);
console.log(
  `fixture : ${cards.length} tuteurs, ${Object.keys(requests).length} demandes, ${users.length} comptes, ${Object.keys(threads).length} conversations, ${Object.values(notifications).flat().length} notifications`,
);
