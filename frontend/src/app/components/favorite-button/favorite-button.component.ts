import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { FavoritesService } from '../../core/favorites/favorites.service';

/** Cœur « favori » avec une petite explosion de particules quand on l'active. */
@Component({
  selector: 'app-favorite-button',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (auth.role() === 'etudiant') {
    <button
      type="button"
      class="fav"
      [class.on]="on()"
      [class.pop]="pop()"
      [attr.aria-pressed]="on()"
      [attr.aria-label]="(on() ? 'fav.remove' : 'fav.add') | transloco"
      [attr.title]="(on() ? 'fav.remove' : 'fav.add') | transloco"
      (click)="toggle($event)"
    >
      <svg viewBox="0 0 24 24" class="heart" aria-hidden="true">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
      <span class="burst" aria-hidden="true">@for (i of dots; track i) {<i [style.--a]="i * 45 + 'deg'"></i>}</span>
    </button>
  }`,
  styles: `
    .fav { position: relative; z-index: 2; width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--trait); background: var(--blanc);
      display: inline-flex; align-items: center; justify-content: center; color: var(--gris); transition: transform 0.2s, border-color 0.2s; }
    .fav:hover { transform: scale(1.08); border-color: #e0a2a2; color: var(--brique); }
    .heart { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linejoin: round; transition: fill 0.2s; }
    .on { color: #d2443a; border-color: color-mix(in srgb, #d2443a 35%, transparent); background: color-mix(in srgb, #d2443a 10%, var(--blanc)); }
    .on .heart { fill: currentColor; }
    .pop .heart { animation: heart 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .burst { position: absolute; inset: 0; pointer-events: none; }
    .burst i { position: absolute; left: 50%; top: 50%; width: 5px; height: 5px; margin: -2.5px; border-radius: 50%; background: var(--soleil); opacity: 0; }
    .burst i:nth-child(even) { background: #d2443a; }
    .pop .burst i { animation: burst 0.6s ease-out; }
    @keyframes heart { 0% { transform: scale(0.6); } 60% { transform: scale(1.35); } 100% { transform: scale(1); } }
    @keyframes burst { 0% { opacity: 1; transform: rotate(var(--a)) translateY(0); } 100% { opacity: 0; transform: rotate(var(--a)) translateY(-26px); } }
  `,
})
export class FavoriteButtonComponent {
  readonly tutorId = input.required<string>();
  protected readonly auth = inject(AuthService);
  private readonly favorites = inject(FavoritesService);
  protected readonly on = computed(() => this.favorites.ids().has(this.tutorId()));
  protected readonly pop = signal(false);
  protected readonly dots = [0, 1, 2, 3, 4, 5, 6, 7];

  protected toggle(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    const added = this.favorites.toggle(this.tutorId());
    this.pop.set(false);
    if (added) requestAnimationFrame(() => this.pop.set(true));
  }
}
