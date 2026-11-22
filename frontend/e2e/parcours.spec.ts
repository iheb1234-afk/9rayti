import { expect, Page, test } from '@playwright/test';

/**
 * Parcours principaux de 9rayti, joués sur le build démo (données simulées dans le navigateur).
 * Chaque test part d'un état neuf : le stockage local est vidé par Playwright entre les tests.
 */

// Diagnostic : erreurs de la page et de la console, affichées si un test échoue.
const problems = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const list: string[] = [];
  problems.set(page, list);
  page.on('pageerror', (e) => list.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') list.push(`${m.type()}: ${m.text()}`);
  });
});
test.afterEach(({ page }, info) => {
  if (info.status !== info.expectedStatus)
    console.log(
      `[diagnostic] ${info.title} @ ${page.url()}\n${(problems.get(page) ?? []).join('\n')}`,
    );
});

async function login(page: Page, email: string) {
  await page.goto('connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('demo1234');
  await page.getByRole('button', { name: 'Se connecter' }).last().click();
  await expect(page).not.toHaveURL(/connexion/);
}

test.describe('Accueil', () => {
  test('affiche le titre, les chiffres et la démo anti-fuite', async ({ page }) => {
    await page.goto('');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('réussi');
    await expect(page.getByRole('link', { name: /Je cherche un tuteur/ }).first()).toBeVisible();
    // La démo de messagerie (bloc @defer) se charge à l'approche, puis masque le numéro.
    await page.locator('.ph-leak').scrollIntoViewIfNeeded();
    const chat = page.getByRole('figure', { name: /numéro de téléphone/ });
    await chat.scrollIntoViewIfNeeded();
    await expect(page.locator('.num.done')).toHaveText('•••', { timeout: 10_000 });
  });

  test('passe en arabe (de droite à gauche) puis en mode sombre', async ({ page, isMobile }) => {
    await page.goto('');
    if (isMobile) await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'العربية' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await page.locator('app-theme-toggle button').first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('la recherche rapide (Ctrl K) ouvre une page', async ({ page, isMobile }) => {
    test.skip(isMobile, 'raccourci clavier');
    await page.goto('');
    await page.keyboard.press('Control+k');
    const box = page.getByRole('combobox', { name: 'Recherche rapide' });
    await expect(box).toBeFocused();
    await box.fill('sessions');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/sessions/);
  });
});

test.describe('Étudiant', () => {
  test('réserve un cours chez un tuteur et le retrouve dans son espace', async ({ page }) => {
    await login(page, 'omar@9rayti.tn');
    await page.goto('recherche?matiere=probabilites');
    await page.locator('app-tutor-card a.stretch').first().click();
    await expect(page).toHaveURL(/tuteurs\//);
    await page.getByRole('radio').first().click();
    await page.getByRole('radio', { name: /Carte bancaire/ }).click();
    await page.getByRole('button', { name: 'Envoyer la demande' }).click();
    await expect(page.getByRole('status')).toContainText('Demande envoyée');
    await page.getByRole('link', { name: 'Suivre ma demande' }).click();
    await expect(page.getByText('En attente').first()).toBeVisible();
  });

  test('les coordonnées envoyées en message sont masquées', async ({ page }) => {
    await login(page, 'yasmine@9rayti.tn');
    await page.goto('messages');
    await page.locator('a.th').first().click();
    await page
      .getByRole('textbox', { name: 'Écris ton message…' })
      .fill('Mon numéro : 22 345 678, écris-moi sur WhatsApp');
    await page.keyboard.press('Enter');
    const last = page.locator('.bubble.me').last();
    await expect(last).toContainText('•••');
    await expect(last).not.toContainText('22 345 678');
    await expect(last).toContainText('Coordonnées masquées');
  });

  test('envoie un message par le formulaire de contact', async ({ page }) => {
    await page.goto('contact');
    await page.getByRole('button', { name: 'Envoyer le message' }).click();
    await expect(page.getByText('Indique ton nom')).toBeVisible();
    await page.getByLabel('Nom complet').fill('Test Playwright');
    await page.getByLabel('Adresse e-mail').fill('test@exemple.tn');
    await page
      .getByLabel('Message', { exact: true })
      .fill('Bonjour, une question sur les sessions de groupe.');
    await page.getByRole('button', { name: 'Envoyer le message' }).click();
    await expect(page.getByRole('status')).toContainText('Message envoyé');
  });
});

test.describe('Tuteur et administration', () => {
  test('le tuteur accepte une demande et consulte ses revenus', async ({ page }) => {
    await login(page, 'youssef@9rayti.tn');
    await expect(page).toHaveURL(/espace-tuteur/);
    await page.getByRole('button', { name: 'Accepter' }).first().click();
    await expect(page.getByText(/salle de cours est ouverte/)).toBeVisible();
    await page.getByRole('tab', { name: 'Revenus' }).click();
    await expect(
      page.getByRole('heading', { name: /Revenus des 12 dernières semaines/ }),
    ).toBeVisible();
  });

  test("l'admin rembourse un cours signalé", async ({ page }) => {
    await login(page, 'admin@9rayti.tn');
    await page.getByRole('tab', { name: /Signalements/ }).click();
    await page.getByRole('button', { name: 'Trancher' }).first().click();
    await page
      .getByLabel('Note de décision')
      .fill('Le tuteur est arrivé avec 25 minutes de retard.');
    await page.getByRole('button', { name: 'Confirmer la décision' }).click();
    await expect(page.getByText('Étudiant remboursé.')).toBeVisible();
    await expect(page.getByText('Aucun signalement en attente')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('page introuvable : la porte se laisse frapper', async ({ page }) => {
    await page.goto('une-page-qui-nexiste-pas');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Cette page n'existe pas");
    await expect(page.getByRole('link', { name: "Retour à l'accueil" })).toBeVisible();
  });

  test('le menu mobile s’ouvre et mène à « Comment ça marche »', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'menu du téléphone');
    await page.goto('');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('link', { name: 'Comment ça marche' }).first().click();
    await expect(page).toHaveURL(/comment-ca-marche/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Comment ça marche');
  });
});
