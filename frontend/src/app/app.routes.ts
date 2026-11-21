import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/auth/auth.guards';

/**
 * Plan du site (Objectif 2) : quatre espaces, trois clics au plus.
 * Chaque page est chargée à la demande (lazy loading) : le premier écran reste léger.
 */
export const routes: Routes = [
  // Espace public
  {
    path: '',
    loadComponent: () => import('./pages/public/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'recherche',
    loadComponent: () => import('./pages/public/search/search.page').then((m) => m.SearchPage),
  },
  {
    path: 'tuteurs/:id',
    loadComponent: () =>
      import('./pages/public/tutor-profile/tutor-profile.page').then((m) => m.TutorProfilePage),
  },
  {
    path: 'sessions',
    loadComponent: () =>
      import('./pages/public/sessions/sessions.page').then((m) => m.SessionsPage),
  },
  {
    path: 'connexion',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'inscription',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/register/register.page').then((m) => m.RegisterPage),
  },

  // Espace étudiant
  {
    path: 'mon-espace',
    canActivate: [roleGuard('etudiant')],
    loadComponent: () =>
      import('./pages/student/student-space/student-space.page').then((m) => m.StudentSpacePage),
  },

  // Espace tuteur
  {
    path: 'espace-tuteur',
    canActivate: [roleGuard('tuteur')],
    loadComponent: () =>
      import('./pages/tutor/tutor-space/tutor-space.page').then((m) => m.TutorSpacePage),
  },

  // Commun étudiant / tuteur
  {
    path: 'salle/:id',
    canActivate: [roleGuard('etudiant', 'tuteur')],
    loadComponent: () => import('./pages/classroom/classroom.page').then((m) => m.ClassroomPage),
  },

  // Administration
  {
    path: 'admin',
    canActivate: [roleGuard('admin')],
    loadComponent: () =>
      import('./pages/admin/admin-dashboard/admin-dashboard.page').then(
        (m) => m.AdminDashboardPage,
      ),
  },

  {
    path: '**',
    loadComponent: () =>
      import('./pages/public/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
