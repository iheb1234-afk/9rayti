import { Injectable, effect, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { AuthService } from '../auth/auth.service';

/** Tuteurs favoris de l'étudiant connecté (cœur sur les cartes et le profil). */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  readonly ids = signal<ReadonlySet<string>>(new Set());

  constructor() {
    effect(() => {
      if (this.auth.role() === 'etudiant') {
        this.api
          .favoriteIds()
          .subscribe({ next: (ids) => this.ids.set(new Set(ids)), error: () => undefined });
      } else {
        this.ids.set(new Set());
      }
    });
  }

  has(tutorId: string): boolean {
    return this.ids().has(tutorId);
  }

  /** Bascule le favori, de façon optimiste (l'écran change tout de suite). */
  toggle(tutorId: string): boolean {
    const adding = !this.has(tutorId);
    const next = new Set(this.ids());
    if (adding) next.add(tutorId);
    else next.delete(tutorId);
    this.ids.set(next);
    const call = adding ? this.api.addFavorite(tutorId) : this.api.removeFavorite(tutorId);
    call.subscribe({
      next: (ids) => this.ids.set(new Set(ids)),
      error: () => this.ids.set(new Set(this.ids())),
    });
    return adding;
  }
}
