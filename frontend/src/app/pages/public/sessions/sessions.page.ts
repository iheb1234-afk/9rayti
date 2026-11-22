import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { catchError, of } from 'rxjs';
import { UI } from '../../../components';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { SessionCardComponent } from '../../../components/session-card/session-card.component';
import { ApiService } from '../../../core/api/api.service';
import { ExamSession } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { LangService } from '../../../core/i18n/lang.service';
import { RevealDirective } from '../../../directives/reveal.directive';

/** Sessions d'examen en groupe : un tuteur, plusieurs étudiants, un prix par place plus bas. */
@Component({
  selector: 'app-sessions',
  imports: [
    RouterLink,
    TranslocoPipe,
    PageHeaderComponent,
    SessionCardComponent,
    EmptyStateComponent,
    RevealDirective,
    ...UI,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sessions.page.html',
  styleUrl: './sessions.page.scss',
})
export class SessionsPage {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  protected readonly subject = signal<string>('');
  protected readonly data = rxResource({
    params: () => this.auth.role(),
    stream: ({ params }) =>
      params === 'etudiant' ? this.api.myExamSessions() : this.api.examSessions(),
  });
  private readonly all = computed<ExamSession[]>(() => this.data.value() ?? []);
  /** Matières pour lesquelles une session est prévue (filtres). */
  protected readonly subjects = computed(() => {
    const seen = new Map<string, ExamSession['subject']>();
    for (const s of this.all()) seen.set(s.subject.code, s.subject);
    return [...seen.values()];
  });
  protected readonly list = computed(() =>
    this.all().filter((s) => !this.subject() || s.subject.code === this.subject()),
  );
  protected readonly allSubjects = toSignal(this.api.subjects().pipe(catchError(() => of([]))), {
    initialValue: [],
  });

  constructor() {
    inject(LangService).setTitle('sessions.title');
  }
}
