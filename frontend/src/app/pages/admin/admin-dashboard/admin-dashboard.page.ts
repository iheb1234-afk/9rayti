import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { UI } from '../../../components';
import { EmptyStateComponent } from '../../../components/empty-state/empty-state.component';
import { ModalComponent } from '../../../components/modal/modal.component';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { StatTileComponent } from '../../../components/stat-tile/stat-tile.component';
import { TabItem, TabsComponent } from '../../../components/tabs/tabs.component';
import { ApiService } from '../../../core/api/api.service';
import { AdminSubject, CourseRequest, RequestState } from '../../../core/api/models';
import { errorMessage } from '../../../core/http/error-message';
import { LangService } from '../../../core/i18n/lang.service';
import { ToastService } from '../../../core/ui/toast.service';
import { DtPipe } from '../../../pipes/dt.pipe';

type Tab = 'apercu' | 'validation' | 'signalements' | 'cours' | 'matieres' | 'contact';
const TABS: Tab[] = ['apercu', 'validation', 'signalements', 'cours', 'matieres', 'contact'];
const STATES: RequestState[] = ['en_attente', 'acceptee', 'faite', 'versee', 'signalee', 'remboursee', 'refusee', 'expiree', 'annulee', 'annulee_tuteur'];

/**
 * Espace administrateur (sitemap : tableau de bord, validation des tuteurs, signalements,
 * cours et paiements, matières) + messages reçus par le formulaire de contact.
 */
@Component({
  selector: 'app-admin',
  imports: [FormsModule, TranslocoPipe, PageHeaderComponent, StatTileComponent, TabsComponent, ModalComponent, EmptyStateComponent, ...UI],
  providers: [DtPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-dashboard.page.html',
  styleUrl: './admin-dashboard.page.scss',
})
export class AdminDashboardPage {
  readonly onglet = input<string>();
  protected readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  private readonly dt = inject(DtPipe);
  protected readonly money = (m: number) => this.dt.transform(m);
  protected readonly states = STATES;
  protected readonly tab = linkedSignal<string>(() => (TABS.includes(this.onglet() as Tab) ? (this.onglet() as Tab) : 'apercu'));

  protected readonly overview = rxResource({ stream: () => this.api.adminOverview() });
  protected readonly pending = rxResource({ stream: () => this.api.pendingTutors() });
  protected readonly reports = rxResource({ stream: () => this.api.adminReports() });
  protected readonly subjects = rxResource({ stream: () => this.api.adminSubjects() });
  protected readonly contacts = rxResource({ stream: () => this.api.contactMessages() });

  // Cours et paiements : filtre par état, recherche et pagination côté serveur.
  protected readonly filterState = signal('');
  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly list = rxResource({
    params: () => ({ state: this.filterState() || undefined, search: this.search().trim() || undefined, page: this.page() }),
    stream: ({ params }) => this.api.adminRequests(params),
  });

  protected readonly total = computed(() => (this.overview.value()?.requests ?? []).reduce((s, r) => s + r.count, 0));
  protected readonly volume = computed(() => (this.overview.value()?.requests ?? []).reduce((s, r) => s + r.volumeMillimes, 0));
  protected readonly maxCount = computed(() => Math.max(1, ...(this.overview.value()?.requests ?? []).map((r) => r.count)));
  protected readonly tabs = computed<TabItem[]>(() => {
    const o = this.overview.value();
    const counts: Partial<Record<Tab, number>> = { validation: o?.tutors.pending, signalements: o?.reports, contact: o?.contacts };
    return TABS.map((id) => ({ id, label: this.i18n.translate(`admin.tab.${id}`), count: counts[id] }));
  });

  protected readonly busy = signal(false);
  // Signalement en cours de traitement
  protected readonly resolving = signal<CourseRequest | null>(null);
  protected decision: 'rembourser' | 'verser' = 'rembourser';
  protected note = '';
  private readonly resolveModal = viewChild.required<ModalComponent>('resolveModal');
  // Matières
  protected newSubject = { code: '', nameFr: '', nameAr: '', nameEn: '' };
  protected readonly editing = signal<AdminSubject | null>(null);
  protected edit = { nameFr: '', nameAr: '', nameEn: '' };
  private readonly subjectModal = viewChild.required<ModalComponent>('subjectModal');

  constructor() {
    inject(LangService).setTitle('admin.title');
  }

  private run(obs: Observable<unknown>, okKey: string, after?: () => void): void {
    this.busy.set(true);
    obs.subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(this.i18n.translate(okKey));
        this.overview.reload();
        after?.();
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.show(errorMessage(e), 'err');
      },
    });
  }

  protected validate(id: string): void {
    this.run(this.api.validateTutor(id), 'admin.validated', () => this.pending.reload());
  }

  protected openResolve(r: CourseRequest): void {
    this.resolving.set(r);
    this.decision = 'rembourser';
    this.note = '';
    this.resolveModal().open();
  }

  protected resolve(): void {
    const r = this.resolving();
    if (!r || this.note.trim().length < 3) return;
    this.run(this.api.resolveReport(r.id, this.decision, this.note.trim()), `admin.resolved.${this.decision}`, () => {
      this.resolveModal().close();
      this.reports.reload();
      this.list.reload();
    });
  }

  protected setFilter(state: string): void {
    this.filterState.set(state);
    this.page.set(1);
  }

  protected onSearch(q: string): void {
    this.search.set(q);
    this.page.set(1);
  }

  protected addSubject(): void {
    const s = this.newSubject;
    const code = s.code.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    if (!code || !s.nameFr.trim()) return;
    this.run(this.api.addSubject({ code, nameFr: s.nameFr.trim(), nameAr: s.nameAr.trim() || s.nameFr.trim(), nameEn: s.nameEn.trim() || s.nameFr.trim() }), 'admin.subjectAdded', () => {
      this.newSubject = { code: '', nameFr: '', nameAr: '', nameEn: '' };
      this.subjects.reload();
    });
  }

  protected openEdit(s: AdminSubject): void {
    this.editing.set(s);
    this.edit = { nameFr: s.nameFr, nameAr: s.nameAr, nameEn: s.nameEn };
    this.subjectModal().open();
  }

  protected saveSubject(): void {
    const s = this.editing();
    if (s) this.run(this.api.updateSubject(s.id, this.edit), 'admin.subjectSaved', () => (this.subjectModal().close(), this.subjects.reload()));
  }

  protected toggleContact(id: number, status: 'nouveau' | 'traite'): void {
    this.run(this.api.setContactStatus(id, status === 'nouveau' ? 'traite' : 'nouveau'), 'admin.contactSaved', () => this.contacts.reload());
  }
}
