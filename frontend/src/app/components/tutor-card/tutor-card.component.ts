import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../core/api/api.service';
import { TutorCard } from '../../core/api/models';
import { SharedElementService } from '../../core/ui/shared-element.service';
import { TiltDirective } from '../../directives/tilt.directive';
import { FavoriteButtonComponent } from '../favorite-button/favorite-button.component';
import { UI } from '../index';

/**
 * Carte d'un tuteur dans les résultats de recherche et les favoris. Toute la carte est
 * cliquable (le lien du nom est étiré) ; l'avatar s'envole ensuite vers le profil.
 */
@Component({
  selector: 'app-tutor-card',
  imports: [RouterLink, TranslocoPipe, TiltDirective, FavoriteButtonComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tutor-card.component.html',
  styleUrl: './tutor-card.component.scss',
})
export class TutorCardComponent {
  readonly tutor = input.required<TutorCard>();
  readonly subject = input<string>('');
  protected readonly api = inject(ApiService);
  protected readonly shared = inject(SharedElementService);

  protected open(e: MouseEvent): void {
    const card = e.currentTarget as HTMLElement;
    this.shared.markTutor(this.tutor().id, card.querySelector<HTMLElement>('.arc'));
  }
}
