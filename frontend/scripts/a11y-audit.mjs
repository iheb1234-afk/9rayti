// Audit d'accessibilité (axe-core, règles WCAG 2.1 A/AA) des pages principales.
// Prérequis : API (port 3000) et front (port 4200) lancés, Playwright installé (npx playwright install chromium).
// Usage : node scripts/a11y-audit.mjs > ../docs/accessibilite.md
// Chaque page est parcourue jusqu'en bas avant l'audit : les sections différées (@defer) sont donc auditées aussi.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const WEB = process.env.WEB ?? 'http://localhost:4200';
const API = process.env.API ?? 'http://localhost:3000/api';

const session = async (email) =>
  (
    await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'demo1234' }),
    })
  ).json();
const tutors = await (await fetch(`${API}/tutors?subject=probabilites`)).json();
const y = await session('yasmine@9rayti.tn');
const accepted = (
  await (
    await fetch(`${API}/requests/mine`, { headers: { authorization: `Bearer ${y.token}` } })
  ).json()
).find((r) => r.state === 'acceptee');

const sessions = await (await fetch(`${API}/exam-sessions`)).json();

const pages = [
  ['Accueil', '/', null, 'fr'],
  ['Accueil (arabe, RTL)', '/', null, 'ar'],
  ['Accueil (anglais)', '/', null, 'en'],
  ['Accueil (mode sombre)', '/', null, 'fr', 'dark'],
  ['Comment ça marche', '/comment-ca-marche', null, 'fr'],
  ['Devenir tuteur', '/devenir-tuteur', null, 'fr'],
  ['À propos', '/a-propos', null, 'fr'],
  ['Contact', '/contact', null, 'fr'],
  ['Conditions d’utilisation', '/cgu', null, 'fr'],
  ['Recherche', '/recherche?matiere=probabilites', null, 'fr'],
  ['Profil tuteur', `/tuteurs/${tutors[0].id}`, 'yasmine@9rayti.tn', 'fr'],
  ['Connexion', '/connexion', null, 'fr'],
  ['Inscription tuteur', '/inscription?role=tuteur', null, 'fr'],
  ['Espace étudiant', '/mon-espace', 'yasmine@9rayti.tn', 'fr'],
  ['Salle de cours', `/salle/${accepted?.id}`, 'yasmine@9rayti.tn', 'fr'],
  ['Sessions d’examen', '/sessions', 'omar@9rayti.tn', 'fr'],
  ['Détail d’une session', `/sessions/${sessions[0]?.id}`, 'omar@9rayti.tn', 'fr'],
  ['Messagerie', `/messages/${tutors[0].id}`, 'yasmine@9rayti.tn', 'fr'],
  ['Notifications', '/notifications', 'yasmine@9rayti.tn', 'fr'],
  ['Profil', '/profil', 'sarra@9rayti.tn', 'fr'],
  ['Espace tuteur', '/espace-tuteur', 'sarra@9rayti.tn', 'fr'],
  ['Espace tuteur : revenus', '/espace-tuteur?onglet=revenus', 'sarra@9rayti.tn', 'fr'],
  ['Espace tuteur (mode sombre)', '/espace-tuteur?onglet=revenus', 'sarra@9rayti.tn', 'fr', 'dark'],
  ['Administration', '/admin', 'admin@9rayti.tn', 'fr'],
  ['Administration : signalements', '/admin?onglet=signalements', 'admin@9rayti.tn', 'fr'],
  ['Page 404', '/introuvable', null, 'fr'],
];
const browser = await chromium.launch();
const rows = [];
let total = 0;
for (const [name, url, who, lang, theme = 'light'] of pages) {
  // Mouvements réduits : le contenu s'affiche sans attendre la fin des animations.
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const s = who ? await session(who) : null;
  await ctx.addInitScript(
    ([s, lang, theme]) => {
      localStorage.setItem('9rayti.lang', lang);
      localStorage.setItem('9rayti.theme', theme);
      if (s) localStorage.setItem('9rayti.session', JSON.stringify(s));
    },
    [s, lang, theme],
  );
  const p = await ctx.newPage();
  await p.goto(WEB + url, { waitUntil: 'networkidle' });
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 150));
    }
    scrollTo(0, 0);
  });
  await p.waitForTimeout(600);
  await p.addScriptTag({ content: axeSource });
  const res = await p.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    }),
  );
  total += res.violations.length;
  rows.push({
    name,
    url,
    passes: res.passes.length,
    violations: res.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length} élément(s))`),
  });
  await ctx.close();
}
await browser.close();
console.log(
  `# Audit d'accessibilité — axe-core ${JSON.parse(readFileSync(require.resolve('axe-core/package.json'), 'utf8')).version}\n`,
);
console.log(
  `Règles WCAG 2.1 niveaux A et AA, ${new Date().toISOString().slice(0, 10)}, Chromium, 1280 × 900. Chaque page est parcourue jusqu'en bas avant l'audit (sections différées comprises).\n`,
);
console.log('| Page | Règles respectées | Violations |\n|---|---|---|');
for (const r of rows)
  console.log(
    `| ${r.name} | ${r.passes} | ${r.violations.length ? r.violations.join('<br>') : 'aucune'} |`,
  );
console.log(`\n**Total : ${total} violation(s).**`);
