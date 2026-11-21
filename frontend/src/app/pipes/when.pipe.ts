import { Pipe, PipeTransform, inject } from '@angular/core';
import { LangService } from '../core/i18n/lang.service';

export type WhenStyle = 'full' | 'day' | 'time' | 'short' | 'relative';

/** Date et heure dans la langue active, toujours à l'heure de Tunis, sur 24 h. */
@Pipe({ name: 'when', pure: false })
export class WhenPipe implements PipeTransform {
  private readonly lang = inject(LangService);

  transform(iso: string | null | undefined, style: WhenStyle = 'full'): string {
    if (!iso) return '—';
    if (style === 'relative') return this.relative(iso);
    const opts: Intl.DateTimeFormatOptions =
      style === 'time'
        ? { hour: '2-digit', minute: '2-digit' }
        : style === 'day'
          ? { weekday: 'short', day: 'numeric', month: 'short' }
          : style === 'short'
            ? { day: 'numeric', month: 'short', year: 'numeric' }
            : {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              };
    return new Intl.DateTimeFormat(this.lang.locale(), {
      ...opts,
      hourCycle: 'h23',
      timeZone: 'Africa/Tunis',
    }).format(new Date(iso));
  }

  /** « il y a 5 min », « dans 2 h »… */
  private relative(iso: string): string {
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(this.lang.locale(), { numeric: 'auto' });
    const abs = Math.abs(diff);
    if (abs < 60) return rtf.format(Math.round(diff), 'second');
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    return rtf.format(Math.round(diff / 86400), 'day');
  }
}
