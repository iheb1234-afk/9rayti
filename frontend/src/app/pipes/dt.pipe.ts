import { Pipe, PipeTransform, inject } from '@angular/core';
import { LangService } from '../core/i18n/lang.service';

/** Montant en millimes (entier) → « 23 DT » / « 23 د.ت », selon la langue active. */
@Pipe({ name: 'dt', pure: false })
export class DtPipe implements PipeTransform {
  private readonly lang = inject(LangService);

  transform(millimes: number | null | undefined, decimals = 0): string {
    if (millimes === null || millimes === undefined) return '—';
    const n = new Intl.NumberFormat(this.lang.locale(), {
      minimumFractionDigits: decimals,
      maximumFractionDigits: Math.max(decimals, 1),
    }).format(millimes / 1000);
    return this.lang.lang() === 'ar' ? `${n} د.ت` : `${n} DT`;
  }
}
