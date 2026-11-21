import { Pipe, PipeTransform, inject } from '@angular/core';
import { LangService } from '../core/i18n/lang.service';

/** Nombre décimal dans la langue active (4,8 en français, 4.8 en anglais). */
@Pipe({ name: 'num', pure: false })
export class NumPipe implements PipeTransform {
  private readonly lang = inject(LangService);

  transform(n: number | null | undefined, digits = 1): string {
    return n === null || n === undefined
      ? '—'
      : new Intl.NumberFormat(this.lang.locale(), { maximumFractionDigits: digits }).format(n);
  }
}
