# Recherche : projets similaires sur GitHub

*21 novembre 2026, avant l'Objectif 4.* But : voir ce que font les plateformes de tutorat open source, lire leur code, garder les bonnes idées et faire mieux.

## Méthode

1. Recherche GitHub (API) : « tutoring platform angular », « tutoring marketplace », « peer tutoring », « tutor booking nestjs », « online tutoring platform », « mentor marketplace », « italki clone », « tutoring app », sujet `tutoring`.
2. **11 dépôts clonés et lus** (README, arborescence, dépendances, extraits de code) : les plus proches de 9rayti par l'usage (mise en relation étudiant ↔ tuteur, réservation, cours en ligne) ou par la technique (Angular, NestJS, PostgreSQL).

## Projets étudiés

| Projet | Technologies | Ce qu'il fait bien | Ce qu'on en retient |
|---|---|---|---|
| **UPchieve/web** (association américaine, en production) | Vue 3, Vuetify, socket.io, Playwright | Tutorat gratuit en direct ; tableau blanc partagé, chat, récapitulatif de séance, favoris, **modération des messages** (coordonnées et contenus interdits), confettis de célébration, tests Playwright | Messagerie **qui masque les coordonnées** (notre règle anti-fuite), favoris, récapitulatif après le cours, célébration à la réservation |
| **yt314/Talmidon** | **Angular 21**, PrimeNG, ASP.NET, PostgreSQL | Le plus abouti en Angular : centre de notifications avec liens directs, recherche rapide `Ctrl+K`, partage de profil (lien, WhatsApp, QR), mode sombre sans flash, directives *reveal* / *spotlight* / *count-up*, structure `core / shared / features` | Notifications, `Ctrl+K`, partage avec QR, mode sombre appliqué avant le démarrage, directives d'animation réutilisables |
| **discuno/discuno** | Next.js, Drizzle, Cal.com | Classement des mentors par score pondéré (réservations faites +10, annulées −5, déclin de 5 % par semaine), tests Vitest | Classement plus juste : **moyenne bayésienne** des notes + taux de réponse + cours donnés |
| **t1112000/tutor-management-app** (MyClass, 110 ★) | Next.js 15, PostgreSQL, PWA | Graphiques de revenus, rappels push, application installable | Page **Revenus** avec graphique |
| **nitin-580/mentor-mate** | React, Express, Razorpay | Tableaux de bord mentor / mentoré / admin, revenus, statut des séances | Confirmation du parcours en 3 espaces + admin |
| **shabeelashraf5/TutorMate** | Angular + NestJS + MongoDB | Même pile que nous ; dossiers `features/` et `shared/components` | Organisation par fonctionnalité |
| **pierreTklein/peer-tutoring-app** | React, Express, socket.io | File d'attente de questions, **notifications du navigateur**, statistiques pour l'équipe | Notifications en temps réel |
| **duongminhhieu/LetTutor-2024** | Flutter | Tuteurs favoris, prochain cours avec compte à rebours, signalement, réglages langue / thème | Favoris, compte à rebours du prochain cours |
| **anniegiang/iFluent** (clone d'italki) | React, Rails | Recherche par langue, réservation | — |
| **tylertaewook/tutor-scheduler-django** | Django, pytest | Réservation de séances entre pairs, couverture de tests | — |
| **upex-galaxy/upex-my-mentor** | Next.js | Documentation produit très structurée (PRD, SRS, épopées) | — |

## Ce que 9rayti fait déjà mieux

- **Trois langues dont l'arabe en droite-à-gauche** : aucun projet étudié ne le propose (Talmidon est en hébreu, en une seule langue).
- **Règles d'argent écrites et testées** : machine à états, délai de 12 h, remboursement en crédits, verrous contre la double réservation. Aucun projet étudié ne gère l'expiration automatique des demandes.
- **Démo en ligne sans serveur** qui applique les mêmes règles que l'API.
- **Accessibilité mesurée** (axe-core, WCAG 2.1 AA) et tests de bout en bout sur une vraie base.

## Ce qu'on ajoute grâce à la recherche (Objectif 4)

1. **Messagerie avec masquage des coordonnées** (inspirée de la modération d'UPchieve) : les numéros, e-mails et liens WhatsApp / Instagram sont masqués, pour que les cours restent sur 9rayti.
2. **Notifications en temps réel** (Server-Sent Events) avec un centre de notifications et des liens directs (Talmidon, peer-tutoring-app).
3. **Tuteurs favoris** et « réserver à nouveau » (UPchieve, LetTutor).
4. **Recherche rapide `Ctrl+K`** et **partage du profil** avec QR code (Talmidon).
5. **Mode sombre** sans flash au chargement (Talmidon), avec une transition circulaire.
6. **Revenus du tuteur en graphique** (MyClass, mentor-mate).
7. **Classement bayésien** des tuteurs (idée de score pondéré de discuno).
8. **Célébration** quand une réservation part ou qu'un cours est accepté (UPchieve).
9. **Tests de bout en bout Playwright** sur Chromium, Firefox et WebKit (UPchieve utilise Playwright).

Et, ce qu'aucun d'eux ne fait : des **animations soignées** (GSAP chargé à la demande, transitions entre pages, porte de Sidi Bou Saïd qui s'ouvre), en respectant `prefers-reduced-motion`.
