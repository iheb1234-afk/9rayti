import { HttpInterceptorFn } from '@angular/common/http';

/** Mode démonstration (GitHub Pages) : remplacé plus bas par un faux serveur en mémoire. */
export const demoInterceptor: HttpInterceptorFn = (req, next) => next(req);
