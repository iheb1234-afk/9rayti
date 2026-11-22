// Audit d'accessibilité (axe-core, règles WCAG 2.1 A/AA) des pages principales.
// Prérequis : API (port 3000) et front (port 4200) lancés, Playwright installé (npx playwright install chromium).
// Usage : node scripts/a11y-audit.mjs > ../docs/accessibilite.md
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

const pages = [
  ['Accueil', '/', null, 'fr'],
  ['Accueil (arabe, RTL)', '/', null, 'ar'],
  ['Recherche', '/recherche?matiere=probabilites', null, 'fr'],
  ['Profil tuteur', `/tuteurs/${tutors[0].id}`, 'yasmine@9rayti.tn', 'fr'],
  ['Connexion', '/connexion', null, 'fr'],
  ['Inscription tuteur', '/inscription?role=tuteur', null, 'fr'],
  ['Espace étudiant', '/mon-espace', 'yasmine@9rayti.tn', 'fr'],
  ['Salle de cours', `/salle/${accepted?.id}`, 'yasmine@9rayti.tn', 'fr'],
  ['Sessions d’examen', '/sessions', 'omar@9rayti.tn', 'fr'],
  ['Espace tuteur', '/espace-tuteur', 'sarra@9rayti.tn', 'fr'],
  ['Page 404', '/introuvable', null, 'fr'],
];
const browser = await chromium.launch();
const rows = [];
let total = 0;
for (const [name, url, who, lang] of pages) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const s = who ? await session(who) : null;
  await ctx.addInitScript(
    ([s, lang]) => {
      localStorage.setItem('9rayti.lang', lang);
      if (s) localStorage.setItem('9rayti.session', JSON.stringify(s));
    },
    [s, lang],
  );
  const p = await ctx.newPage();
  await p.goto(WEB + url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
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
  `Règles WCAG 2.1 niveaux A et AA, ${new Date().toISOString().slice(0, 10)}, Chromium, 1280 × 900.\n`,
);
console.log('| Page | Règles respectées | Violations |\n|---|---|---|');
for (const r of rows)
  console.log(
    `| ${r.name} | ${r.passes} | ${r.violations.length ? r.violations.join('<br>') : 'aucune'} |`,
  );
console.log(`\n**Total : ${total} violation(s).**`);
