import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';

/** Fine barre de progression en haut de l'écran pendant le chargement d'une page. */
@Component({
  selector: 'app-route-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div
    class="rp"
    [class.on]="state() === 'loading'"
    [class.done]="state() === 'done'"
    aria-hidden="true"
  ></div>`,
  styles: `
    .rp {
      position: fixed;
      top: 0;
      inset-inline-start: 0;
      height: 3px;
      width: 0;
      z-index: 100;
      background: linear-gradient(90deg, var(--soleil), var(--bleu));
      opacity: 0;
      box-shadow: 0 0 10px rgba(233, 178, 58, 0.6);
    }
    .on {
      opacity: 1;
      width: 80%;
      transition: width 2.5s cubic-bezier(0.1, 0.8, 0.2, 1);
    }
    .done {
      opacity: 0;
      width: 100%;
      transition:
        width 0.2s ease,
        opacity 0.4s 0.2s ease;
    }
  `,
})
export class RouteProgressComponent {
  protected readonly state = signal<'idle' | 'loading' | 'done'>('idle');

  constructor() {
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationStart) this.state.set('loading');
      else if (
        e instanceof NavigationEnd ||
        e instanceof NavigationCancel ||
        e instanceof NavigationError
      )
        this.state.set('done');
    });
  }
}
