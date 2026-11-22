import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CountUpDirective } from '../../directives/count-up.directive';
import { TiltDirective } from '../../directives/tilt.directive';

/** Tuile de chiffre clé (crédits, gains, réputation…) avec un compteur animé. */
@Component({
  selector: 'app-stat-tile',
  imports: [CountUpDirective, TiltDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:contents' },
  template: `<div class="card tile" [class.main]="main()" appTilt="4">
    <h3 class="muted small">{{ label() }}</h3>
    @if (value() !== undefined) {
      <div class="big" [appCountUp]="value() ?? null" [format]="format()"></div>
    }
    <ng-content />
  </div>`,
})
export class StatTileComponent {
  readonly label = input.required<string>();
  readonly value = input<number | null | undefined>(undefined);
  readonly format = input<(n: number) => string>((n) => Math.round(n).toLocaleString());
  readonly main = input(false);
}
