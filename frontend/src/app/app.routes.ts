import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/http';

/** Chaque page est chargée à la demande (lazy loading) : le premier écran reste léger. */
export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home.page').then((m) => m.HomePage), title: '9rayti · Tutorat entre étudiants' },
  { path: 'recherche', loadComponent: () => import('./pages/search.page').then((m) => m.SearchPage) },
  { path: 'tuteurs/:id', loadComponent: () => import('./pages/tutor.page').then((m) => m.TutorPage) },
  { path: 'sessions', loadComponent: () => import('./pages/sessions.page').then((m) => m.SessionsPage) },
  { path: 'connexion', canActivate: [guestGuard], loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage) },
  { path: 'inscription', canActivate: [guestGuard], loadComponent: () => import('./pages/register.page').then((m) => m.RegisterPage) },
  { path: 'mon-espace', canActivate: [roleGuard('etudiant')], loadComponent: () => import('./pages/student.page').then((m) => m.StudentPage) },
  { path: 'espace-tuteur', canActivate: [roleGuard('tuteur')], loadComponent: () => import('./pages/tutor-space.page').then((m) => m.TutorSpacePage) },
  { path: 'salle/:id', canActivate: [roleGuard('etudiant', 'tuteur')], loadComponent: () => import('./pages/classroom.page').then((m) => m.ClassroomPage) },
  { path: 'admin', canActivate: [roleGuard('admin')], loadComponent: () => import('./pages/admin.page').then((m) => m.AdminPage) },
  { path: '**', loadComponent: () => import('./pages/not-found.page').then((m) => m.NotFoundPage) },
];
