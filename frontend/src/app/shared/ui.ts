import { ChangeDetectionStrategy, Component, Injectable, Pipe, PipeTransform, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LangService } from '../core/lang.service';
import { ICONS } from './icons';

/** Icône Lucide en SVG inline (décorative par défaut, donc masquée aux lecteurs d'écran). */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:contents' },
  template: `<svg class="ic" [class.flip]="flip()" [class.spin]="name() === 'loader-circle'" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-linecap="round" stroke-linejoin="round" [attr.aria-hidden]="label() ? null : 'true'" [attr.role]="label() ? 'img' : null"
    [attr.aria-label]="label()" [innerHTML]="svg()"></svg>`,
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);
  readonly name = input.required<string>();
  readonly label = input<string | null>(null);
  readonly flip = input(false);
  // Contenu issu du paquet lucide-static, généré à la compilation : pas d'entrée utilisateur.
  protected readonly svg = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()] ?? ''));
}

/** Logo : l'arche des portes de Sidi Bou Saïd, avec le « 9 » de 9rayti. */
@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="logo"><svg class="mk" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M8 96 V44 A42 42 0 0 1 92 44 V96 Z" [attr.fill]="light() ? '#fff' : '#0D4F9C'" />
      <text x="50" y="80" text-anchor="middle" font-size="62" font-weight="700" [attr.fill]="light() ? '#0B3C78' : '#fff'" font-family="Readex Pro">9</text>
    </svg><span dir="ltr">rayti</span><span class="ar" lang="ar">قرايتي</span></span>`,
  styles: `
    .logo { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; font-size: 24px; color: var(--bleu); letter-spacing: -.02em; }
    .ar { font-size: 19px; color: var(--bleu-nuit); }
    .mk { width: 30px; height: 30px; flex: none; }
    :host-context(.ft) .logo { color: #fff; } :host-context(.ft) .ar { color: #dce6f3; }
  `,
})
export class LogoComponent {
  readonly light = input(false);
}

/** Avatar en arche avec les initiales. */
@Component({
  selector: 'app-arc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:contents' },
  template: `<span class="arc" aria-hidden="true" [style.width.px]="size()" [style.height.px]="size() * 1.19" [style.font-size.px]="size() * 0.32">{{ initials() }}</span>`,
})
export class ArcComponent {
  readonly name = input.required<string>();
  readonly size = input(64);
  protected readonly initials = computed(() =>
    this.name().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
  );
}

/** Montant en millimes → « 23 DT » / « 23 د.ت ». */
@Pipe({ name: 'dt', pure: false })
export class DtPipe implements PipeTransform {
  private readonly lang = inject(LangService);
  transform(millimes: number | null | undefined, decimals = 0): string {
    if (millimes === null || millimes === undefined) return '—';
    const n = new Intl.NumberFormat(this.lang.locale(), { minimumFractionDigits: decimals, maximumFractionDigits: Math.max(decimals, 1) })
      .format(millimes / 1000);
    return this.lang.lang() === 'ar' ? `${n} د.ت` : `${n} DT`;
  }
}

/** Date et heure dans la langue active, à l'heure de Tunis. */
@Pipe({ name: 'when', pure: false })
export class WhenPipe implements PipeTransform {
  private readonly lang = inject(LangService);
  transform(iso: string | null | undefined, style: 'full' | 'day' | 'time' | 'short' = 'full'): string {
    if (!iso) return '—';
    const opts: Intl.DateTimeFormatOptions =
      style === 'time' ? { hour: '2-digit', minute: '2-digit' }
      : style === 'day' ? { weekday: 'short', day: 'numeric', month: 'short' }
      : style === 'short' ? { day: 'numeric', month: 'short', year: 'numeric' }
      : { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    return new Intl.DateTimeFormat(this.lang.locale(), { ...opts, hourCycle: 'h23', timeZone: 'Africa/Tunis' }).format(new Date(iso));
  }
}

/** Nombre décimal dans la langue active (4,8 en français, 4.8 en anglais). */
@Pipe({ name: 'num', pure: false })
export class NumPipe implements PipeTransform {
  private readonly lang = inject(LangService);
  transform(n: number | null | undefined): string {
    return n === null || n === undefined ? '—' : new Intl.NumberFormat(this.lang.locale(), { maximumFractionDigits: 1 }).format(n);
  }
}

/** Nom de matière dans la langue active. */
@Pipe({ name: 'subject', pure: false })
export class SubjectPipe implements PipeTransform {
  private readonly lang = inject(LangService);
  transform(s: { nameFr: string; nameAr: string; nameEn: string } | null | undefined): string {
    return this.lang.subjectName(s);
  }
}

/** Notifications courtes, annoncées aux lecteurs d'écran (aria-live). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly items = signal<{ id: number; text: string; kind: 'ok' | 'err' }[]>([]);
  private seq = 0;
  show(text: string, kind: 'ok' | 'err' = 'ok'): void {
    const id = ++this.seq;
    this.items.update((l) => [...l, { id, text, kind }]);
    setTimeout(() => this.items.update((l) => l.filter((t) => t.id !== id)), 4500);
  }
}

export const UI = [IconComponent, LogoComponent, ArcComponent, DtPipe, WhenPipe, SubjectPipe, NumPipe] as const;
