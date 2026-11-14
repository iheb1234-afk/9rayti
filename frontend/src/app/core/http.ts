import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Role } from './models';

/** Ajoute le jeton JWT aux appels de l'API et déconnecte proprement si la session a expiré. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const toApi = req.url.startsWith(environment.apiUrl);
  const authed = token && toApi ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && token && toApi && !req.url.endsWith('/auth/login')) {
        auth.logout(false);
        void router.navigate(['/connexion'], { queryParams: { expired: 1, next: router.url } });
      }
      return throwError(() => err);
    }),
  );
};

/** Message lisible à partir d'une erreur de l'API (les messages du serveur sont déjà en français). */
export function errorMessage(err: unknown, fallback = 'Une erreur est survenue. Réessaie.'): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Impossible de joindre le serveur 9rayti. Vérifie que l’API est lancée.';
    const m = err.error?.message;
    if (Array.isArray(m)) return m.join(' · ');
    if (typeof m === 'string') return m;
  }
  return fallback;
}

/** Routes réservées à un compte connecté, éventuellement d'un rôle précis. */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.loggedIn()) return router.createUrlTree(['/connexion'], { queryParams: { next: state.url } });
    if (roles.length && !roles.includes(auth.role()!)) return router.createUrlTree([auth.homeFor(auth.role())]);
    return true;
  };
}

/** Connexion et inscription : inutile d'y revenir une fois connecté. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.loggedIn() ? inject(Router).createUrlTree([auth.homeFor(auth.role())]) : true;
};
