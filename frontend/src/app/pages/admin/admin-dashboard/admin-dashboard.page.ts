import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { environment } from '../../../../environments/environment';
import { errorMessage } from '../../../core/http/error-message';
import { LangService } from '../../../core/i18n/lang.service';
import { RequestState } from '../../../core/api/models';
import { StateBadgeComponent } from '../../../components/state-badge/state-badge.component';
import { ToastService } from '../../../core/ui/toast.service';
import { UI } from '../../../components/index';

interface Overview {
  tutors: { validated: number; pending: number };
  requests: { state: RequestState; count: number; volumeMillimes: number }[];
}
interface PendingTutor {
  id: string;
  name: string;
  email: string;
  school: string;
  year: string;
  declaredAverage: number | null;
  subjects: string[];
  createdAt: string;
}

/** Espace administrateur : valider les tuteurs (une seule fois) et suivre l'activité. */
@Component({
  selector: 'app-admin',
  imports: [TranslocoPipe, StateBadgeComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-dashboard.page.html',
  styleUrl: './admin-dashboard.page.scss',
})
export class AdminDashboardPage {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  private readonly base = environment.apiUrl;
  protected readonly overview = rxResource({
    stream: () => this.http.get<Overview>(`${this.base}/admin/overview`),
  });
  protected readonly pending = rxResource({
    stream: () => this.http.get<PendingTutor[]>(`${this.base}/admin/tutors/pending`),
  });
  protected readonly busy = signal(false);

  constructor() {
    inject(LangService).setTitle('admin.title');
  }

  total(o: Overview) {
    return o.requests.reduce((s, r) => s + r.count, 0);
  }
  volume(o: Overview) {
    return o.requests.reduce((s, r) => s + r.volumeMillimes, 0);
  }

  validate(id: string): void {
    this.busy.set(true);
    this.http.post(`${this.base}/admin/tutors/${id}/validate`, {}).subscribe({
      next: () => {
        this.busy.set(false);
        this.pending.reload();
        this.overview.reload();
        this.toast.show(this.i18n.translate('admin.validated'));
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.show(errorMessage(e), 'err');
      },
    });
  }
}
