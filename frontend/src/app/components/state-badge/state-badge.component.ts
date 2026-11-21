import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { RequestState } from '../../core/api/models';

const TONE: Record<RequestState, string> = {
  en_attente: 'sun',
  acceptee: 'blue',
  faite: '',
  versee: '',
  signalee: 'red',
  remboursee: 'grey',
  refusee: 'grey',
  expiree: 'grey',
  annulee: 'grey',
  annulee_tuteur: 'red',
};

/** Pastille colorée de l'état d'une demande de cours. */
@Component({
  selector: 'app-state-badge',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:contents' },
  template: `<span class="badge {{ tone() }}">{{ 'state.' + state() | transloco }}</span>`,
})
export class StateBadgeComponent {
  readonly state = input.required<RequestState>();
  protected readonly tone = computed(() => TONE[this.state()]);
}
