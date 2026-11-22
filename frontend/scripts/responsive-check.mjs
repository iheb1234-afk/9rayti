// Vérifie qu'aucune page ne déborde horizontalement, du petit téléphone au grand écran.
// Prérequis : API (port 3000) et front lancés, Playwright installé (npx playwright install chromium).
// Usage : node scripts/responsive-check.mjs > ../docs/responsive.md
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const WEB = process.env.WEB ?? 'http://localhost:4200';
const API = process.env.API ?? 'http://localhost:3000/api';
const WIDTHS = [360, 390, 768, 1024, 1440];

const session = async (email) =>
  (
    await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'demo1234' }),
    })
  ).json();
const tutors = await (await fetch(`${API}/tutors?subject=probabilites`)).json();
const sessions = await (await fetch(`${API}/exam-sessions`)).json();
const y = await session('yasmine@9rayti.tn');
const room = (
  await (
    await fetch(`${API}/requests/mine`, { headers: { authorization: `Bearer ${y.token}` } })
  ).json()
).find((r) => r.state === 'acceptee');

const Y = 'yasmine@9rayti.tn',
  S = 'sarra@9rayti.tn',
  A = 'admin@9rayti.tn';
const pages = [
  ['Accueil', '/', null, 'fr'],
  ['Accueil (arabe)', '/', null, 'ar'],
  ['Recherche', '/recherche?matiere=probabilites', null, 'fr'],
  ['Profil tuteur', `/tuteurs/${tutors[0].id}`, Y, 'fr'],
  ['Sessions', '/sessions', null, 'fr'],
  ['Détail d’une session', `/sessions/${sessions[0]?.id}`, null, 'fr'],
  ['Comment ça marche', '/comment-ca-marche', null, 'fr'],
  ['Comment ça marche (arabe)', '/comment-ca-marche', null, 'ar'],
  ['Devenir tuteur', '/devenir-tuteur', null, 'fr'],
  ['À propos', '/a-propos', null, 'fr'],
  ['Contact', '/contact', null, 'fr'],
  ['CGU', '/cgu', null, 'fr'],
  ['Connexion', '/connexion', null, 'fr'],
  ['Inscription', '/inscription?role=tuteur', null, 'fr'],
  ['Espace étudiant', '/mon-espace', Y, 'fr'],
  ['Espace étudiant (arabe)', '/mon-espace', Y, 'ar'],
  ['Salle de cours', `/salle/${room?.id}`, Y, 'fr'],
  ['Messagerie', `/messages/${tutors[0].id}`, Y, 'fr'],
  ['Notifications', '/notifications', Y, 'fr'],
  ['Profil', '/profil', S, 'fr'],
  ['Espace tuteur : revenus', '/espace-tuteur?onglet=revenus', S, 'fr'],
  ['Administration : cours', '/admin?onglet=cours', A, 'fr'],
  ['Page 404', '/introuvable', null, 'fr'],
];

const browser = await chromium.launch();
const rows = [];
let faults = 0;
for (const [name, url, who, lang] of pages) {
  const s = who ? await session(who) : null;
  const cells = [];
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
      isMobile: width < 768,
      hasTouch: width < 768,
    });
    await ctx.addInitScript(
      ([s, lang]) => {
        localStorage.setItem('9rayti.lang', lang);
        if (s) localStorage.setItem('9rayti.session', JSON.stringify(s));
      },
      [s, lang],
    );
    const p = await ctx.newPage();
    await p.goto(WEB + url, { waitUntil: 'networkidle' });
    // Parcourt la page pour faire apparaître les sections différées.
    const extra = await p.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
      await new Promise((r) => setTimeout(r, 300));
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
    if (extra > 0) faults++;
    cells.push(extra > 0 ? `+${extra} px` : 'ok');
    await ctx.close();
  }
  rows.push(`| ${name} | ${cells.join(' | ')} |`);
}
await browser.close();

console.log('# Vérification responsive : débordement horizontal\n');
console.log(
  `${new Date().toISOString().slice(0, 10)}, Chromium. Pour chaque page et chaque largeur d'écran, la page est parcourue jusqu'en bas puis on mesure si elle est plus large que la fenêtre (« ok » = aucun défilement horizontal).\n`,
);
console.log(`| Page | ${WIDTHS.map((w) => `${w} px`).join(' | ')} |`);
console.log(`|---|${WIDTHS.map(() => '---').join('|')}|`);
rows.forEach((r) => console.log(r));
console.log(`\n**${faults === 0 ? 'Aucun débordement.' : `${faults} débordement(s).`}**`);
