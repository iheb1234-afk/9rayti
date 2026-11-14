// Capture les réponses de l'API locale (données de démonstration fraîches) pour le mode démo
// hors-ligne publié sur GitHub Pages. Usage : node scripts/capture-demo.mjs (API lancée sur :3000).
import { writeFileSync } from 'node:fs';
const API = process.env.API ?? 'http://localhost:3000/api';
const get = async (path, token) => {
  const r = await fetch(API + path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
};
const login = async (email) =>
  (await fetch(API + '/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'demo1234' }) })).json();

const subjects = await get('/subjects');
const cards = await get('/tutors');
const tutors = {};
for (const c of cards) tutors[c.id] = await get(`/tutors/${c.id}`);
const users = [];
const requests = {};
const classrooms = {};
const credits = {};
const tutorExtra = {};
for (const email of ['yasmine@9rayti.tn', 'omar@9rayti.tn', 'sarra@9rayti.tn', 'youssef@9rayti.tn', 'amira@9rayti.tn', 'mehdi@9rayti.tn', 'nour@9rayti.tn', 'admin@9rayti.tn']) {
  const s = await login(email);
  users.push(s.user);
  if (s.user.role === 'etudiant') {
    for (const r of await get('/requests/mine', s.token)) {
      requests[r.id] = r;
      if (['acceptee', 'faite', 'versee', 'signalee'].includes(r.state)) classrooms[r.id] = await get(`/classroom/${r.id}`, s.token);
    }
    credits[s.user.id] = await get('/credits/me', s.token);
  }
  if (s.user.role === 'tuteur') {
    for (const r of await get('/tutor/requests', s.token)) requests[r.id] = r;
    tutorExtra[s.user.id] = { slots: await get('/tutor/slots', s.token), rates: await get('/tutor/rates', s.token) };
  }
}
const admin = await login('admin@9rayti.tn');
const pending = await get('/admin/tutors/pending', admin.token);
const omar = await login('omar@9rayti.tn');
const sessions = await get('/exam-sessions/mine', omar.token);
const omarId = omar.user.id;
const examSessions = sessions.map((s) => ({ ...s, bookedBy: s.booked ? [omarId] : [], booked: false }));
writeFileSync(new URL('../src/app/demo/fixture.json', import.meta.url),
  JSON.stringify({ capturedAt: new Date().toISOString(), subjects, tutors, users, requests, classrooms, credits, tutorExtra, pending, examSessions }));
console.log(`fixture : ${cards.length} tuteurs, ${Object.keys(requests).length} demandes, ${users.length} comptes`);
