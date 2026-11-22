# Performance : mesures Lighthouse avant / après (Objectif 4)

*22 novembre 2026.* La note de performance de l'accueil sur mobile passe de **57 à 80**, et la page ne bouge plus pendant le chargement (CLS **0,677 → 0**). Accessibilité, bonnes pratiques et SEO restent à **100** sur toutes les pages mesurées.

## Conditions de mesure

- **Lighthouse 12.8.2**, Chromium sans interface, profils **mobile** (téléphone moyen, 4G lente simulée, processeur ralenti) et **ordinateur** (`--preset=desktop`).
- Site **de démonstration** (`npm run build:demo`), servi en local sous `/9rayti/` exactement comme sur GitHub Pages (fichiers compressés, dossiers de routes).
- **Plusieurs passages par page, on garde la médiane** : sur mobile, la note varie de ±10 points d'un passage à l'autre (3 à 7 passages selon la page).
- **Avant** = version rendue pour l'Objectif 3. **Après** = version de l'Objectif 4.

## Résultats

| Page (profil) | Performance | LCP | TBT | CLS |
|---|---|---|---|---|
| Accueil (mobile) | **57 → 80** | 2,9 s → 3,6 s | 530 → 340 ms | 0,677 → 0 |
| Accueil (ordinateur) | **90 → 99** | 0,7 s → 0,9 s | 10 → 0 ms | 0,197 → 0,048 |
| Recherche (mobile) | **70 → 88** | 2,5 s → 3,0 s | 300 → 200 ms | 0,388 → 0 |
| Recherche (ordinateur) | **97 → 99** | 0,6 s → 0,9 s | 20 → 0 ms | 0,097 → 0 |
| Sessions (mobile) | **68 → 90** | 2,5 s → 2,9 s | 230 → 200 ms | 0,632 → 0 |
| Comment ça marche (mobile, nouvelle) | **89** | 3,2 s | 140 ms | 0 |
| Devenir tuteur (mobile, nouvelle) | **87** | 3,3 s | 180 ms | 0 |

**Lecture.** Le LCP (affichage du plus grand élément) augmente de 0,4 à 0,7 s sur mobile : le site embarque désormais 20 pages, trois langues complètes et un premier écran animé. La note monte quand même, car la stabilité (CLS, 25 % de la note) et le temps de blocage (TBT, 30 %) s'améliorent nettement.

## Ce qui a été fait

1. **Lazy loading de chaque page** (`loadComponent`) : un visiteur ne télécharge jamais les espaces étudiant, tuteur ou administration. Code initial : 414 ko, **117 ko compressés**.
2. **Sections différées** : les 8 sections sous le premier écran de l'accueil sont en `@defer (on viewport; prefetch on idle)`, avec un emplacement réservé à leur hauteur finale (ordinateur et téléphone) : rien ne bouge quand elles arrivent. C'est ce qui fait tomber le CLS de 0,677 à 0.
3. **GSAP au premier défilement** : le premier écran (porte, titre, parallaxe) n'utilise que du CSS ; GSAP, ScrollTrigger et SplitText ne se chargent qu'au premier geste (molette, toucher, clavier, défilement).
4. **Bibliothèques à la demande** : confettis (`canvas-confetti`) et QR code (`qrcode`) sont importés seulement au moment où ils servent.
5. **Mode démo à part** : l'API simulée (137 ko, 18 ko compressés) est un fichier séparé, chargé par un intercepteur à la première requête ; le site complet ne le télécharge jamais.
6. **Une seule langue téléchargée** : la langue de secours n'est plus chargée en plus de la langue choisie.
7. **Angular sans zone.js**, `ChangeDetectionStrategy.OnPush` et signals partout : moins de travail à chaque interaction (TBT).
8. **Polices auto-hébergées** (Readex Pro latin et arabe, woff2), avatars en `loading="lazy"`, décors en CSS et SVG plutôt qu'en images.
9. **Plus de saut de mise en page** : squelettes de chargement à hauteur fixe ; sur la recherche, le bandeau « session de groupe » apparaît en même temps que les résultats (CLS 0,388 → 0).
10. **Budgets de taille** dans `angular.json` : la compilation avertit si le code initial ou le style d'un composant grossit trop.

## Refaire la mesure

```bash
cd frontend
npm run build:demo
node e2e/serve.mjs                      # sert le site sur http://localhost:4300/9rayti/
npx lighthouse http://localhost:4300/9rayti/ --view                    # mobile
npx lighthouse http://localhost:4300/9rayti/ --preset=desktop --view   # ordinateur
```
