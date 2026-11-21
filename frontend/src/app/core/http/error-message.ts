import { HttpErrorResponse } from '@angular/common/http';

/** Message lisible à partir d'une erreur de l'API (les messages du serveur sont rédigés pour l'utilisateur). */
export function errorMessage(
  err: unknown,
  fallback = 'Une erreur est survenue. Réessaie.',
): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0)
      return 'Impossible de joindre le serveur 9rayti. Vérifie que l’API est lancée.';
    const m = err.error?.message;
    if (Array.isArray(m)) return m.join(' · ');
    if (typeof m === 'string') return m;
  }
  return fallback;
}
