import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { reducedMotion } from '../motion/motion';

export type Theme = 'light' | 'dark';
const KEY = '9rayti.theme';

/**
 * Thème clair / sombre. Le choix initial est posé par le script de index.html avant le démarrage
 * (préférence du système, ou choix mémorisé) : pas de flash blanc. Le changement se fait avec
 * une révélation circulaire qui part du bouton (API View Transitions).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  readonly theme = signal<Theme>(
    (this.doc.documentElement.getAttribute('data-theme') as Theme) || 'light',
  );

  toggle(event?: MouseEvent): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    const apply = () => this.apply(next);
    const doc = this.doc as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
    };
    if (!doc.startViewTransition || reducedMotion()) return apply();

    const x = event?.clientX ?? innerWidth - 40;
    const y = event?.clientY ?? 30;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const root = this.doc.documentElement;
    root.classList.add('theme-transition');
    const t = doc.startViewTransition(apply);
    t.ready
      .then(() =>
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          {
            duration: 650,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        ),
      )
      .catch(() => undefined);
    t.finished.finally(() => root.classList.remove('theme-transition'));
  }

  private apply(theme: Theme): void {
    this.theme.set(theme);
    this.doc.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* navigation privée : on ignore */
    }
  }
}
