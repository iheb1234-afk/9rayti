import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { catchError, of } from 'rxjs';
import { UI } from '../../../components';
import { ApiService } from '../../../core/api/api.service';
import { LangService } from '../../../core/i18n/lang.service';
import { CountUpDirective } from '../../../directives/count-up.directive';
import { RevealDirective } from '../../../directives/reveal.directive';
import { SplitTextDirective } from '../../../directives/split-text.directive';
import { TiltDirective } from '../../../directives/tilt.directive';

/** À propos : la mission, les valeurs, ce qui distingue 9rayti, et l'histoire du projet. */
@Component({
  selector: 'app-about',
  imports: [
    RouterLink,
    TranslocoPipe,
    CountUpDirective,
    RevealDirective,
    SplitTextDirective,
    TiltDirective,
    ...UI,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about.page.html',
  styleUrl: './about.page.scss',
})
export class AboutPage {
  private readonly api = inject(ApiService);
  protected readonly stats = toSignal(this.api.stats().pipe(catchError(() => of(null))), {
    initialValue: null,
  });
  protected readonly values = [
    { key: 'help', icon: 'heart-handshake' },
    { key: 'trust', icon: 'shield-check' },
    { key: 'clear', icon: 'scale' },
  ];
  /** Comparaison avec les deux façons habituelles de trouver de l'aide. */
  protected readonly rows = ['verified', 'protected', 'refund', 'replay', 'price', 'rating'];
  protected readonly compare: Record<string, [boolean, boolean, boolean]> = {
    verified: [true, false, false],
    protected: [true, false, false],
    refund: [true, false, false],
    replay: [true, false, false],
    price: [true, false, true],
    rating: [true, false, false],
  };
  protected readonly timeline = [1, 2, 3, 4];

  constructor() {
    inject(LangService).setTitle('about.title');
  }
}
