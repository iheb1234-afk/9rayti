import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/** Ajoute le jeton JWT aux appels de l'API et déconnecte proprement si la session a expiré. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const toApi = req.url.startsWith(environment.apiUrl);
  const authed =
    token && toApi ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
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
