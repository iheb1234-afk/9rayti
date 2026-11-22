import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { UI } from '../../../components';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { errorMessage } from '../../../core/http/error-message';
import { LangService } from '../../../core/i18n/lang.service';
import { celebrate, originOf } from '../../../core/motion/motion';
import { ToastService } from '../../../core/ui/toast.service';
import { remaining } from '../../../core/utils/time';
import { RevealDirective } from '../../../directives/reveal.directive';

/** Détail d'une session d'examen (sitemap : « Sessions d'examen › Détail, réserver »). */
@Component({
  selector: 'app-session-detail-page',
  imports: [RouterLink, TranslocoPipe, EmptyStateComponent, RevealDirective, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-detail.page.html',
  styleUrl: './session-detail.page.scss',
})
export class SessionDetailPage {
  readonly id = input.required<string>();
  protected readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  private readonly lang = inject(LangService);
  protected readonly busy = signal(false);
  protected readonly Math = Math;

  protected readonly session = rxResource({
    params: () => ({ id: this.id(), logged: this.auth.loggedIn() }),
    stream: ({ params }) => this.api.examSession(params.id, params.logged),
  });
  protected readonly left = computed(() => {
    const s = this.session.value();
    return s ? remaining(s.startsAt) : null;
  });
  protected readonly seats = computed(() => {
    const s = this.session.value();
    return s ? Array.from({ length: s.placesMax }, (_, i) => ({ taken: i < s.placesTaken, min: i === s.placesMin - 1 })) : [];
  });

  constructor() {
    effect(() => {
      if (this.session.value()) this.lang.setTitle('sessions.detailTitle');
    });
  }

  protected book(event: Event): void {
    const s = this.session.value();
    if (!s) return;
    this.busy.set(true);
    this.api.bookExam(s.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.session.reload();
        this.auth.refresh();
        this.toast.show(this.i18n.translate('sessions.bookedToast'));
        void celebrate(originOf(event));
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.show(errorMessage(e), 'err');
      },
    });
  }
}
