import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** En-tête de page : titre, sous-titre et zone d'actions à droite (contenu projeté). */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="ph">
    <div class="txt">
      @if (kicker()) {
        <span class="badge blue kick">{{ kicker() }}</span>
      }
      <h1>{{ title() }}</h1>
      @if (subtitle()) {
        <p class="muted">{{ subtitle() }}</p>
      }
    </div>
    <div class="actions"><ng-content /></div>
  </header>`,
  styles: `
    .ph { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin: 32px 0 8px; }
    .kick { margin-bottom: 10px; }
    h1 { animation: rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
    p { margin-top: 6px; max-width: 640px; animation: rise 0.6s 0.08s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .actions:empty { display: none; }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly kicker = input<string>('');
}
