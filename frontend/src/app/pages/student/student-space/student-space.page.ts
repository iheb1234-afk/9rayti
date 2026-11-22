import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
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
import { Observable } from 'rxjs';
import { UI } from '../../../components';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { ModalComponent } from '../../../components/modal/modal.component';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { RatingStarsComponent } from '../../../components/rating-stars/rating-stars.component';
import { SessionCardComponent } from '../../../components/session-card/session-card.component';
import { StatTileComponent } from '../../../components/stat-tile/stat-tile.component';
import { TabItem, TabsComponent } from '../../../components/tabs/tabs.component';
import { TutorCardComponent } from '../../../components/tutor-card/tutor-card.component';
import { ApiService } from '../../../core/api/api.service';
import { CourseRequest } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { FavoritesService } from '../../../core/favorites/favorites.service';
import { errorMessage } from '../../../core/http/error-message';
import { LangService } from '../../../core/i18n/lang.service';
import { celebrate } from '../../../core/motion/motion';
import { ToastService } from '../../../core/ui/toast.service';
import { remaining } from '../../../core/utils/time';
import { DtPipe } from '../../../pipes/dt.pipe';

type Tab = 'cours' | 'historique' | 'favoris' | 'credits' | 'sessions';
const UPCOMING = new Set(['en_attente', 'acceptee', 'faite']);

/** Espace étudiant (sitemap : tableau de bord, mes cours, mes crédits, favoris, sessions). */
@Component({
  selector: 'app-student-space',
  imports: [
    RouterLink,
    FormsModule,
    NgTemplateOutlet,
    TranslocoPipe,
    PageHeaderComponent,
    StatTileComponent,
    TabsComponent,
    ModalComponent,
    RatingStarsComponent,
    EmptyStateComponent,
    TutorCardComponent,
    SessionCardComponent,
    ...UI,
  ],
  providers: [DtPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './student-space.page.html',
  styleUrl: './student-space.page.scss',
})
export class StudentSpacePage {
  readonly onglet = input<string>();
  protected readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly favorites = inject(FavoritesService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  private readonly dt = inject(DtPipe);
  protected readonly money = (m: number) => this.dt.transform(m);
  private readonly ids: Tab[] = ['cours', 'historique', 'favoris', 'credits', 'sessions'];
  /** L'onglet suit ?onglet= dans l'URL, puis les clics. */
  protected readonly tab = linkedSignal<string>(() =>
    this.ids.includes(this.onglet() as Tab) ? (this.onglet() as Tab) : 'cours',
  );

  protected readonly requests = rxResource({ stream: () => this.api.myRequests() });
  protected readonly credits = rxResource({ stream: () => this.api.credits() });
  private readonly sessions = rxResource({ stream: () => this.api.myExamSessions() });
  /** Les favoris se rechargent quand on ajoute ou retire un cœur. */
  protected readonly favs = rxResource({
    params: () => this.favorites.ids().size,
    stream: () => this.api.favorites(),
  });

  protected readonly upcoming = computed(() =>
    (this.requests.value() ?? [])
      .filter(
        (r) => UPCOMING.has(r.state) && !(r.state === 'faite' && !r.canReview && !r.canReport),
      )
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
  );
  protected readonly history = computed(() =>
    (this.requests.value() ?? [])
      .filter((r) => !this.upcoming().includes(r))
      .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt)),
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
  protected readonly hoursLearned = computed(() =>
    (this.requests.value() ?? [])
      .filter((r) => ['faite', 'versee'].includes(r.state))
      .reduce((s, r) => s + r.durationMin / 60, 0),
  );
  protected readonly tabs = computed<TabItem[]>(() => [
    { id: 'cours', label: this.i18n.translate('student.tab.cours'), count: this.upcoming().length },
    { id: 'historique', label: this.i18n.translate('student.tab.historique') },
    {
      id: 'favoris',
      label: this.i18n.translate('student.tab.favoris'),
      count: this.favorites.ids().size || undefined,
    },
    { id: 'credits', label: this.i18n.translate('student.tab.credits') },
    { id: 'sessions', label: this.i18n.translate('student.tab.sessions') },
  ]);

  protected readonly busy = signal(false);
  protected readonly target = signal<CourseRequest | null>(null);
  protected readonly rating = signal(5);
  protected comment = '';
  protected reason = '';
  private readonly reviewModal = viewChild.required<ModalComponent>('reviewModal');
  private readonly reportModal = viewChild.required<ModalComponent>('reportModal');

  constructor() {
    inject(LangService).setTitle('student.title');
  }

  protected left(iso: string) {
    return remaining(iso);
  }

  protected err(e: unknown) {
    return errorMessage(e);
  }

  private run(obs: Observable<unknown>, okKey: string, after?: () => void): void {
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

  protected cancel(r: CourseRequest): void {
    this.run(this.api.cancel(r.id), 'student.cancelled');
  }

  protected openReview(r: CourseRequest): void {
    this.target.set(r);
    this.rating.set(5);
    this.comment = '';
    this.reviewModal().open();
  }

  protected sendReview(): void {
    const r = this.target();
    if (!r) return;
    this.run(this.api.review(r.id, this.rating(), this.comment), 'student.thanks', () => {
      this.reviewModal().close();
      if (this.rating() >= 4) void celebrate();
    });
  }

  protected openReport(r: CourseRequest): void {
    this.target.set(r);
    this.reason = '';
    this.reportModal().open();
  }

  protected sendReport(): void {
    const r = this.target();
    if (r)
      this.run(this.api.report(r.id, this.reason.trim()), 'student.reported', () =>
        this.reportModal().close(),
      );
  }

  protected recharge(dt: number): void {
    this.run(this.api.recharge(dt), 'student.recharged');
  }
}
