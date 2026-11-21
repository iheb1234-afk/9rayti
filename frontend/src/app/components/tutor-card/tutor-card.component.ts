import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LangService } from '../../core/i18n/lang.service';
import { TutorCard } from '../../core/api/models';
import { UI } from '../index';

/** Carte d'un tuteur dans les résultats de recherche. */
@Component({
  selector: 'app-tutor-card',
  imports: [RouterLink, TranslocoPipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tutor-card.component.html',
  styleUrl: './tutor-card.component.scss',
})
export class TutorCardComponent {
  readonly tutor = input.required<TutorCard>();
  readonly subject = input<string>('');
  protected readonly lang = inject(LangService);
  protected readonly x = computed(() => this.tutor().id);
}
