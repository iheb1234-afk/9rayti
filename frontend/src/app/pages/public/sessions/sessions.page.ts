import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { errorMessage } from '../../../core/http/error-message';
import { LangService } from '../../../core/i18n/lang.service';
import { ExamSession } from '../../../core/api/models';
import { ToastService } from '../../../core/ui/toast.service';
import { UI } from '../../../components/index';

/** Sessions d'examen en groupe : un tuteur, plusieurs étudiants, un prix par place plus bas. */
@Component({
  selector: 'app-sessions',
  imports: [RouterLink, TranslocoPipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sessions.page.html',
  styleUrl: './sessions.page.scss',
})
export class SessionsPage {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  protected readonly data = rxResource({
    params: () => this.auth.role(),
    stream: ({ params }) =>
      params === 'etudiant' ? this.api.myExamSessions() : this.api.examSessions(),
  });
  protected readonly list = computed<ExamSession[]>(() => this.data.value() ?? []);
  protected readonly busy = signal<string | null>(null);

  constructor() {
    inject(LangService).setTitle('sessions.title');
  }

  book(s: ExamSession): void {
    this.busy.set(s.id);
    this.api.bookExam(s.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.data.reload();
        this.auth.refresh();
        this.toast.show(this.i18n.translate('sessions.bookedToast'));
      },
      error: (e) => {
        this.busy.set(null);
        this.toast.show(errorMessage(e), 'err');
      },
    });
  }
}
