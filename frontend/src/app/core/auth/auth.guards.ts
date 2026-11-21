import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../api/models';
import { AuthService } from './auth.service';

/** Routes réservées à un compte connecté, éventuellement d'un rôle précis. */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.loggedIn())
      return router.createUrlTree(['/connexion'], { queryParams: { next: state.url } });
    if (roles.length && !roles.includes(auth.role()!))
      return router.createUrlTree([auth.homeFor(auth.role())]);
    return true;
  };
}

/** Connexion et inscription : inutile d'y revenir une fois connecté. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.loggedIn() ? inject(Router).createUrlTree([auth.homeFor(auth.role())]) : true;
};
