import { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Le faux serveur du mode démo (et ses données) est chargé à la première requête vers l'API :
 * il forme un fichier séparé, que le site réel ne télécharge jamais.
 */
let server: Promise<typeof import('./demo.interceptor')> | null = null;

export const lazyDemoInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  server ??= import('./demo.interceptor');
  return from(server).pipe(switchMap((m) => m.demoInterceptor(req, next)));
};
