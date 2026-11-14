import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { environment } from '../../environments/environment';
import { errorMessage } from '../core/http';
import { LangService } from '../core/lang.service';
import { RequestState } from '../core/models';
import { StateBadgeComponent } from '../shared/state-badge.component';
import { ToastService, UI } from '../shared/ui';

interface Overview { tutors: { validated: number; pending: number }; requests: { state: RequestState; count: number; volumeMillimes: number }[]; }
interface PendingTutor { id: string; name: string; email: string; school: string; year: string; declaredAverage: number | null; subjects: string[]; createdAt: string; }

/** Espace administrateur : valider les tuteurs (une seule fois) et suivre l'activité. */
@Component({
  selector: 'app-admin',
  imports: [TranslocoPipe, StateBadgeComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="wrap">
    <h1 class="page-h">{{ 'admin.title' | transloco }}</h1>
    @if (overview.value(); as o) {
      <div class="tiles" style="margin-top:18px">
        <div class="card tile main"><h3>{{ 'admin.tutors' | transloco }}</h3><div class="big w">{{ o.tutors.validated }}</div><div class="muted">{{ 'admin.pendingN' | transloco: { n: o.tutors.pending } }}</div></div>
        <div class="card tile"><h3 class="muted small">{{ 'admin.requests' | transloco }}</h3><div class="big">{{ total(o) }}</div></div>
        <div class="card tile"><h3 class="muted small">{{ 'admin.volume' | transloco }}</h3><div class="big">{{ volume(o) | dt }}</div></div>
      </div>
      <div class="card box">
        <h2 class="h3">{{ 'admin.byState' | transloco }}</h2>
        @for (r of o.requests; track r.state) { <div class="tline"><app-state [state]="r.state" /><span>{{ r.count }} · {{ r.volumeMillimes | dt }}</span></div> }
      </div>
    }
    <div class="card box">
      <h2 class="h3">{{ 'admin.toValidate' | transloco }}</h2>
      @for (t of pending.value() ?? []; track t.id) {
        <div class="tline">
          <div><b>{{ t.name }}</b> · <span class="muted">{{ t.school }}, {{ t.year }}</span>
            <div class="small muted">{{ t.email }} · {{ 'admin.average' | transloco }} {{ t.declaredAverage ?? '—' }} · {{ t.subjects.join(', ') }}</div></div>
          <button type="button" class="btn sm ok" [disabled]="busy()" (click)="validate(t.id)"><app-icon name="badge-check" /> {{ 'admin.validate' | transloco }}</button>
        </div>
      } @empty { <p class="small muted">{{ 'admin.none' | transloco }}</p> }
    </div>
  </div>`,
  styles: `
    .w { color: #fff !important; }
    .box { padding: 22px; margin-top: 16px; }
    .h3 { font-size: 18px; margin-bottom: 8px; }
    .tline { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--trait); flex-wrap: wrap; }
    .tline:last-child { border-bottom: 0; }
  `,
})
export class AdminPage {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  private readonly base = environment.apiUrl;
  protected readonly overview = rxResource({ stream: () => this.http.get<Overview>(`${this.base}/admin/overview`) });
  protected readonly pending = rxResource({ stream: () => this.http.get<PendingTutor[]>(`${this.base}/admin/tutors/pending`) });
  protected readonly busy = signal(false);

  constructor() {
    inject(LangService).setTitle('admin.title');
  }

  total(o: Overview) { return o.requests.reduce((s, r) => s + r.count, 0); }
  volume(o: Overview) { return o.requests.reduce((s, r) => s + r.volumeMillimes, 0); }

  validate(id: string): void {
    this.busy.set(true);
    this.http.post(`${this.base}/admin/tutors/${id}/validate`, {}).subscribe({
      next: () => { this.busy.set(false); this.pending.reload(); this.overview.reload(); this.toast.show(this.i18n.translate('admin.validated')); },
      error: (e) => { this.busy.set(false); this.toast.show(errorMessage(e), 'err'); },
    });
  }
}
