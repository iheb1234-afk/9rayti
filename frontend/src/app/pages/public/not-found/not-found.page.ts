import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { UI } from '../../../components';
import { LangService } from '../../../core/i18n/lang.service';
import { MagneticDirective } from '../../../directives/magnetic.directive';

/** Page introuvable : « 4 0 4 » dont le zéro est une porte bleue qu'on peut frapper. */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink, TranslocoPipe, MagneticDirective, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './not-found.page.html',
  styleUrl: './not-found.page.scss',
})
export class NotFoundPage {
  protected readonly router = inject(Router);
  protected readonly knocks = signal(0);

  constructor() {
    inject(LangService).setTitle('e404.title');
  }

  /** Toc toc : la porte tremble ; au troisième coup, elle s'entrouvre. */
  protected knock(): void {
    this.knocks.update((n) => n + 1);
  }
}
