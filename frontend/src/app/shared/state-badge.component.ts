import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { RequestState } from '../core/models';

const TONE: Record<RequestState, string> = {
  en_attente: 'sun', acceptee: 'blue', faite: '', versee: '', signalee: 'red',
  refusee: 'grey', expiree: 'grey', annulee: 'grey', annulee_tuteur: 'red',
};

/** Pastille de l'état d'une demande de cours. */
@Component({
  selector: 'app-state',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:contents' },
  template: `<span class="badge {{ tone() }}">{{ 'state.' + state() | transloco }}</span>`,
})
export class StateBadgeComponent {
  readonly state = input.required<RequestState>();
  protected readonly tone = computed(() => TONE[this.state()]);
}

/** Temps restant avant une échéance, en heures et minutes. */
export function remaining(iso: string, now = Date.now()): { h: number; m: number } | null {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  return { h: Math.floor(ms / 3_600_000), m: Math.floor((ms % 3_600_000) / 60_000) };
}
