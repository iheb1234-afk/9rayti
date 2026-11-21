import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONS } from './icons';

/**
 * Icône Lucide en SVG inline. Décorative par défaut (masquée aux lecteurs d'écran) ;
 * avec `label`, elle devient une image accessible.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:contents' },
  template: `<svg
    class="ic"
    [class.flip]="flip()"
    [class.spin]="name() === 'loader-circle'"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    [attr.aria-hidden]="label() ? null : 'true'"
    [attr.role]="label() ? 'img' : null"
    [attr.aria-label]="label()"
    [innerHTML]="svg()"
  ></svg>`,
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);
  readonly name = input.required<string>();
  readonly label = input<string | null>(null);
  /** Retourne l'icône en arabe (flèches, chevrons). */
  readonly flip = input(false);
  // Le contenu vient du paquet lucide-static, figé à la compilation : aucune donnée utilisateur.
  protected readonly svg = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()] ?? ''),
  );
}
