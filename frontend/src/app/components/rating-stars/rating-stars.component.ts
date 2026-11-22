import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

/** Étoiles : affichage d'une note, ou saisie (groupe de boutons radio) si `editable`. */
@Component({
  selector: 'app-rating-stars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (editable()) {
      <div class="stars" role="radiogroup" [attr.aria-label]="label()">
        @for (n of five; track n) {
          <button
            type="button"
            role="radio"
            [attr.aria-checked]="value() === n"
            [class.on]="n <= value()"
            [attr.aria-label]="n + ' / 5'"
            (click)="value.set(n)"
          >
            ★
          </button>
        }
      </div>
    } @else {
      <span class="star ro" [attr.aria-label]="value() + ' / 5'" role="img"
        >{{ full() }}<span class="off">{{ empty() }}</span></span
      >
    }`,
  styles: `
    .stars button {
      transition:
        transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
        color 0.2s;
    }
    .stars button:hover,
    .stars button.on {
      transform: scale(1.15);
    }
    .ro {
      letter-spacing: 1px;
    }
    .off {
      color: var(--trait);
    }
  `,
})
export class RatingStarsComponent {
  readonly value = model(0);
  readonly editable = input(false);
  readonly label = input('');
  protected readonly five = [1, 2, 3, 4, 5];
  protected readonly full = computed(() => '★'.repeat(Math.round(this.value())));
  protected readonly empty = computed(() => '★'.repeat(5 - Math.round(this.value())));
}
