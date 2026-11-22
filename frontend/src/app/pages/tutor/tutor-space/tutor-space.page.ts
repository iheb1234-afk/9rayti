import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Observable, catchError, of } from 'rxjs';
import { UI } from '../../../components';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { ModalComponent } from '../../../components/modal/modal.component';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { RevenueChartComponent } from '../../../components/revenue-chart/revenue-chart.component';
import { SessionCardComponent } from '../../../components/session-card/session-card.component';
import { StatTileComponent } from '../../../components/stat-tile/stat-tile.component';
import { TabItem, TabsComponent } from '../../../components/tabs/tabs.component';
import { ApiService } from '../../../core/api/api.service';
import { CourseRequest, ExamSession } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { errorMessage } from '../../../core/http/error-message';
import { LangService } from '../../../core/i18n/lang.service';
import { celebrate, originOf } from '../../../core/motion/motion';
import { ToastService } from '../../../core/ui/toast.service';
import { remaining } from '../../../core/utils/time';
import { DtPipe } from '../../../pipes/dt.pipe';

type Tab = 'demandes' | 'cours' | 'creneaux' | 'tarifs' | 'sessions' | 'revenus';
const TABS: Tab[] = ['demandes', 'cours', 'creneaux', 'tarifs', 'sessions', 'revenus'];

/** Espace tuteur (sitemap : demandes reçues, agenda et tarifs, mes cours, mes sessions, revenus). */
@Component({
  selector: 'app-tutor-space',
  imports: [
    RouterLink,
    FormsModule,
    TranslocoPipe,
    PageHeaderComponent,
    StatTileComponent,
    TabsComponent,
    ModalComponent,
    EmptyStateComponent,
    SessionCardComponent,
    RevenueChartComponent,
    ...UI,
  ],
  providers: [DtPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tutor-space.page.html',
  styleUrl: './tutor-space.page.scss',
})
export class TutorSpacePage {
  readonly onglet = input<string>();
  protected readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly lang = inject(LangService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  private readonly dt = inject(DtPipe);
  protected readonly money = (m: number) => this.dt.transform(m);
  protected readonly tab = linkedSignal<string>(() => (TABS.includes(this.onglet() as Tab) ? (this.onglet() as Tab) : 'demandes'));

  protected readonly dash = rxResource({ stream: () => this.api.tutorDashboard() });
  protected readonly requests = rxResource({ stream: () => this.api.tutorRequests() });
  protected readonly slots = rxResource({ stream: () => this.api.mySlots() });
  protected readonly rates = rxResource({ stream: () => this.api.myRates() });
  protected readonly sessions = rxResource({ stream: () => this.api.myExamSessionsAsTutor() });
  protected readonly revenue = rxResource({ stream: () => this.api.tutorRevenue() });
  protected readonly subjects = toSignal(this.api.subjects().pipe(catchError(() => of([]))), { initialValue: [] });

  protected readonly pending = computed(() => (this.requests.value() ?? []).filter((r) => r.state === 'en_attente'));
  protected readonly courses = computed(() =>
    (this.requests.value() ?? [])
      .filter((r) => ['acceptee', 'faite', 'versee', 'signalee', 'remboursee'].includes(r.state))
      .sort((a, b) => (a.state === 'acceptee' ? -1 : 0) - (b.state === 'acceptee' ? -1 : 0) || +new Date(b.startsAt) - +new Date(a.startsAt)),
  );
  protected readonly tabs = computed<TabItem[]>(() =>
    TABS.map((id) => ({ id, label: this.i18n.translate(`tspace.tab.${id}`), count: id === 'demandes' ? this.pending().length : undefined })),
  );
  /** Les 7 prochains jours, avec les heures libres (vert) et réservées (bleu). */
  protected readonly week = computed(() => {
    const slots = this.slots.value() ?? [];
    const fmt = new Intl.DateTimeFormat(this.lang.locale(), { weekday: 'short', day: 'numeric', timeZone: 'Africa/Tunis' });
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() + i * 86_400_000);
      const k = key.format(d);
      return { key: k, label: fmt.format(d), slots: slots.filter((s) => key.format(new Date(s.startsAt)) === k) };
    });
  });

  protected readonly busy = signal(false);
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected day = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  protected time = '18:00';
  protected duration = 60;
  protected rateCode = 'probabilites';
  protected ratePrice = 20;
  // Nouvelle session d'examen
  protected session = {
    subjectCode: '',
    day: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
    time: '10:00',
    durationMin: 120,
    placesMin: 4,
    placesMax: 8,
    pricePerPlaceDt: 12,
    description: '',
  };
  // Fin de cours : compte rendu facultatif
  protected readonly completing = signal<CourseRequest | null>(null);
  protected recap = '';
  private readonly completeModal = viewChild.required<ModalComponent>('completeModal');

  constructor() {
    this.lang.setTitle('tspace.title');
  }

  protected names(s: ExamSession): string {
    return (s.students ?? []).map((st) => st.firstName).join(', ');
  }

  protected left(iso: string) {
    return remaining(iso);
  }

  private reloadAll(): void {
    this.requests.reload();
    this.dash.reload();
    this.slots.reload();
    this.revenue.reload();
  }

  private run(obs: Observable<unknown>, okKey: string, after?: () => void): void {
    this.busy.set(true);
    obs.subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.translate(okKey));
        this.reloadAll();
        after?.();
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.show(errorMessage(e), 'err');
        this.requests.reload();
      },
    });
  }

  protected act(r: CourseRequest, action: 'accept' | 'refuse' | 'tutor-cancel', event?: Event): void {
    this.run(this.api.act(r.id, action), `tspace.done.${action}`, () => {
      if (action === 'accept') void celebrate(originOf(event));
    });
  }

  protected openComplete(r: CourseRequest): void {
    this.completing.set(r);
    this.recap = '';
    this.completeModal().open();
  }

  protected complete(): void {
    const r = this.completing();
    if (r) this.run(this.api.act(r.id, 'complete', { recap: this.recap.trim() || undefined }), 'tspace.done.complete', () => this.completeModal().close());
  }

  protected addSlot(): void {
    // L'heure saisie est celle de Tunis (UTC+1, sans heure d'été).
    const startsAt = new Date(`${this.day}T${this.time}:00+01:00`).toISOString();
    this.run(this.api.addSlot(startsAt, this.duration), 'tspace.slotAdded');
  }

  protected removeSlot(id: number): void {
    this.run(this.api.removeSlot(id), 'tspace.slotRemoved');
  }

  protected saveRate(): void {
    this.run(this.api.setRate(this.rateCode, Number(this.ratePrice)), 'tspace.rateSaved', () => this.rates.reload());
  }

  protected createSession(event: Event): void {
    const s = this.session;
    const code = s.subjectCode || this.rates.value()?.[0]?.code;
    if (!code) return;
    this.run(
      this.api.createExamSession({
        subjectCode: code,
        startsAt: new Date(`${s.day}T${s.time}:00+01:00`).toISOString(),
        durationMin: Number(s.durationMin),
        placesMin: Number(s.placesMin),
        placesMax: Number(s.placesMax),
        pricePerPlaceDt: Number(s.pricePerPlaceDt),
        description: s.description.trim() || undefined,
      }),
      'tspace.sessionCreated',
      () => {
        this.sessions.reload();
        void celebrate(originOf(event));
      },
    );
  }
}
