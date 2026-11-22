import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Logo : l'arche des portes de Sidi Bou Saïd, avec le « 9 » de 9rayti. */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="logo" [class.light]="light()">
    <svg class="mk" viewBox="0 0 100 100" aria-hidden="true">
      <path class="arch" d="M8 96 V44 A42 42 0 0 1 92 44 V96 Z" />
      <text
        x="50"
        y="80"
        text-anchor="middle"
        font-size="62"
        font-weight="700"
        font-family="Readex Pro"
      >
        9
      </text>
    </svg>
    <span dir="ltr">rayti</span><span class="ar" lang="ar">قرايتي</span>
  </span>`,
  styles: `
    .logo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      font-size: 24px;
      color: var(--lien);
      letter-spacing: -0.02em;
    }
    .ar {
      font-size: 19px;
      color: var(--bleu-nuit);
    }
    .mk {
      width: 30px;
      height: 30px;
      flex: none;
      transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .arch {
      fill: var(--bleu);
    }
    text {
      fill: #fff;
    }
    .light {
      color: #fff;
    }
    .light .ar {
      color: #dce6f3;
    }
    .light .arch {
      fill: #fff;
    }
    .light text {
      fill: var(--bleu-nuit);
    }
    :host(:hover) .mk {
      transform: rotate(-8deg) scale(1.08);
    }
  `,
})
export class LogoComponent {
  /** Version claire, pour les fonds bleus (pied de page). */
  readonly light = input(false);
}
