import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/** État vide illustré (aucun résultat, aucune demande…), avec une action projetée. */
@Component({
  selector: 'app-empty-state',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="empty">
    <div class="arcbig"><app-icon [name]="icon()" /></div>
    <h2>{{ title() }}</h2>
    @if (text()) {
      <p class="muted">{{ text() }}</p>
    }
    <ng-content />
  </div>`,
  styles: `
    .arcbig { animation: float 4s ease-in-out infinite; }
    p { margin: 8px auto 18px; max-width: 460px; }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly text = input<string>('');
}
