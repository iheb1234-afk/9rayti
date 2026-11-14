import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LangService } from '../core/lang.service';
import { UI } from '../shared/ui';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, TranslocoPipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="wrap e404">
    <div>
      <div class="num" aria-hidden="true">404</div>
      <h1>{{ 'e404.title' | transloco }}</h1>
      <p class="muted" style="margin:10px 0 22px">{{ 'e404.text' | transloco }}</p>
      <div class="row"><a class="btn" routerLink="/">{{ 'e404.home' | transloco }}</a><a class="btn alt" routerLink="/recherche">{{ 'nav.find' | transloco }}</a></div>
    </div>
    <div class="door studs" aria-hidden="true"><div class="in"></div></div>
  </div>`,
  styles: `
    .e404 { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; padding: 60px 32px; }
    .num { font-size: 120px; font-weight: 700; color: var(--bleu); line-height: 1; }
    .door { height: 360px; border-radius: 200px 200px 22px 22px; background-color: var(--bleu); position: relative; }
    .door .in { position: absolute; inset: 24px; border-radius: 180px 180px 14px 14px; border: 2px solid rgba(255, 255, 255, .35); }
    @media (max-width: 760px) { .e404 { grid-template-columns: 1fr; padding: 30px 18px; } .num { font-size: 80px; } .door { display: none; } }
  `,
})
export class NotFoundPage {
  constructor() {
    inject(LangService).setTitle('e404.title');
  }
}
