import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { errorMessage } from '../../../core/http/error-message';
import { LangService } from '../../../core/i18n/lang.service';
import { CourseRequest } from '../../../core/api/models';
import { StateBadgeComponent } from '../../../components/state-badge/state-badge.component';
import { remaining } from '../../../core/utils/time';
import { ToastService } from '../../../core/ui/toast.service';
import { UI } from '../../../components/index';

type Tab = 'cours' | 'historique' | 'credits' | 'sessions';
const UPCOMING = new Set(['en_attente', 'acceptee', 'faite']);

@Component({
  selector: 'app-student',
  imports: [RouterLink, FormsModule, NgTemplateOutlet, TranslocoPipe, StateBadgeComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './student-space.page.html',
  styleUrl: './student-space.page.scss',
})
export class StudentSpacePage {
  readonly onglet = input<string>();
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  protected readonly tabs: Tab[] = ['cours', 'historique', 'credits', 'sessions'];
  /** L'onglet suit ?onglet= dans l'URL, puis les clics. */
  protected readonly tab = linkedSignal<Tab>(() =>
    (this.tabs as string[]).includes(this.onglet() ?? '') ? (this.onglet() as Tab) : 'cours',
  );

  protected readonly requests = rxResource({ stream: () => this.api.myRequests() });
  protected readonly credits = rxResource({ stream: () => this.api.credits() });
  private readonly sessions = rxResource({ stream: () => this.api.myExamSessions() });

  protected readonly upcoming = computed(() =>
    (this.requests.value() ?? [])
      .filter(
        (r) => UPCOMING.has(r.state) && !(r.state === 'faite' && !r.canReview && !r.canReport),
      )
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
  );
  protected readonly history = computed(() =>
    (this.requests.value() ?? []).filter((r) => !this.upcoming().includes(r)),
  );
  protected readonly pendingCount = computed(
    () => (this.requests.value() ?? []).filter((r) => r.state === 'en_attente').length,
  );
  protected readonly nextCourse = computed(
    () =>
      this.upcoming().find(
        (r) => r.state === 'acceptee' && +new Date(r.startsAt) > Date.now() - 2 * 3600_000,
      ) ?? null,
  );
  protected readonly mySessions = computed(() =>
    (this.sessions.value() ?? []).filter((s) => s.booked),
  );

  protected readonly busy = signal(false);
  protected readonly target = signal<CourseRequest | null>(null);
  protected readonly rating = signal(5);
  protected comment = '';
  protected reason = '';
  private readonly reviewDlg = viewChild.required<ElementRef<HTMLDialogElement>>('reviewDlg');
  private readonly reportDlg = viewChild.required<ElementRef<HTMLDialogElement>>('reportDlg');

  constructor() {
    inject(LangService).setTitle('student.title');
  }

  left(iso: string) {
    return remaining(iso);
  }
  err(e: unknown) {
    return errorMessage(e);
  }

  private run(obs: ReturnType<ApiService['cancel']>, okKey: string, after?: () => void): void {
    this.busy.set(true);
    obs.subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.translate(okKey));
        this.requests.reload();
        this.credits.reload();
        this.auth.refresh();
        after?.();
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.show(errorMessage(e), 'err');
      },
    });
  }

  cancel(r: CourseRequest): void {
    this.run(this.api.cancel(r.id), 'student.cancelled');
  }

  openReview(r: CourseRequest): void {
    this.target.set(r);
    this.rating.set(5);
    this.comment = '';
    this.reviewDlg().nativeElement.showModal();
  }
  sendReview(): void {
    const r = this.target();
    if (r)
      this.run(this.api.review(r.id, this.rating(), this.comment), 'student.thanks', () =>
        this.reviewDlg().nativeElement.close(),
      );
  }

  openReport(r: CourseRequest): void {
    this.target.set(r);
    this.reason = '';
    this.reportDlg().nativeElement.showModal();
  }
  sendReport(): void {
    const r = this.target();
    if (r)
      this.run(this.api.report(r.id, this.reason.trim()), 'student.reported', () =>
        this.reportDlg().nativeElement.close(),
      );
  }

  recharge(dt: number): void {
    this.busy.set(true);
    this.api.recharge(dt).subscribe({
      next: () => {
        this.busy.set(false);
        this.credits.reload();
        this.auth.refresh();
        this.toast.show(this.i18n.translate('student.recharged'));
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.show(errorMessage(e), 'err');
      },
    });
  }
}
