import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemeService } from '../../core/theme/theme.service';

/** Bouton soleil / lune : le soleil se couche et la lune se lève quand on passe en sombre. */
@Component({
  selector: 'app-theme-toggle',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button
    type="button"
    class="tt"
    [class.dark]="theme.theme() === 'dark'"
    (click)="theme.toggle($event)"
    [attr.aria-label]="(theme.theme() === 'dark' ? 'theme.toLight' : 'theme.toDark') | transloco"
    [attr.title]="(theme.theme() === 'dark' ? 'theme.toLight' : 'theme.toDark') | transloco"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <mask id="tt-moon">
        <rect width="24" height="24" fill="#fff" />
        <circle class="bite" cx="24" cy="4" r="8" fill="#000" />
      </mask>
      <circle class="core" cx="12" cy="12" r="5" mask="url(#tt-moon)" />
      <g class="rays">
        <path
          d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
        />
      </g>
    </svg>
  </button>`,
  styles: `
    .tt {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 1px solid var(--trait);
      background: var(--blanc);
      color: var(--bleu-nuit);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .tt:hover {
      background: var(--fond);
    }
    svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      overflow: visible;
    }
    .core {
      transition: r 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .bite {
      transition:
        cx 0.45s cubic-bezier(0.22, 1, 0.36, 1),
        cy 0.45s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .rays {
      fill: none;
      transform-origin: center;
      transition:
        transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
        opacity 0.3s;
    }
    .dark .core {
      r: 9;
    }
    .dark .bite {
      cx: 17;
      cy: 7;
    }
    .dark .rays {
      opacity: 0;
      transform: rotate(-90deg) scale(0.5);
    }
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
}
