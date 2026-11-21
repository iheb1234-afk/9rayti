import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { catchError, of } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { errorMessage } from '../../../core/http/error-message';
import { LangService } from '../../../core/i18n/lang.service';
import { CourseRequest } from '../../../core/api/models';
import { StateBadgeComponent } from '../../../components/state-badge/state-badge.component';
import { remaining } from '../../../core/utils/time';
import { ToastService } from '../../../core/ui/toast.service';
import { UI } from '../../../components/index';

type Tab = 'demandes' | 'cours' | 'creneaux' | 'tarifs';

@Component({
  selector: 'app-tutor-space',
  imports: [RouterLink, FormsModule, TranslocoPipe, StateBadgeComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tutor-space.page.html',
  styleUrl: './tutor-space.page.scss',
})
export class TutorSpacePage {
  readonly onglet = input<string>();
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly lang = inject(LangService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  protected readonly tabs: Tab[] = ['demandes', 'cours', 'creneaux', 'tarifs'];
  protected readonly tab = linkedSignal<Tab>(() =>
    (this.tabs as string[]).includes(this.onglet() ?? '') ? (this.onglet() as Tab) : 'demandes',
  );

  protected readonly dash = rxResource({ stream: () => this.api.tutorDashboard() });
  protected readonly requests = rxResource({ stream: () => this.api.tutorRequests() });
  protected readonly slots = rxResource({ stream: () => this.api.mySlots() });
  protected readonly rates = rxResource({ stream: () => this.api.myRates() });
  protected readonly subjects = toSignal(this.api.subjects().pipe(catchError(() => of([]))), {
    initialValue: [],
  });

  protected readonly pending = computed(() =>
    (this.requests.value() ?? []).filter((r) => r.state === 'en_attente'),
  );
  protected readonly courses = computed(() =>
    (this.requests.value() ?? [])
      .filter((r) => ['acceptee', 'faite', 'versee', 'signalee'].includes(r.state))
      .sort(
        (a, b) =>
          (a.state === 'acceptee' ? -1 : 0) - (b.state === 'acceptee' ? -1 : 0) ||
          +new Date(b.startsAt) - +new Date(a.startsAt),
      ),
  );
  /** Les 7 prochains jours, avec les heures libres (vert) et réservées (bleu). */
  protected readonly week = computed(() => {
    const slots = this.slots.value() ?? [];
    const fmt = new Intl.DateTimeFormat(this.lang.locale(), {
      weekday: 'short',
      day: 'numeric',
      timeZone: 'Africa/Tunis',
    });
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() + i * 86_400_000);
      const k = key.format(d);
      return {
        key: k,
        label: fmt.format(d),
        slots: slots.filter((s) => key.format(new Date(s.startsAt)) === k),
      };
    });
  });

  protected readonly busy = signal(false);
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected day = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  protected time = '18:00';
  protected duration = 60;
  protected rateCode = 'probabilites';
  protected ratePrice = 20;

  constructor() {
    this.lang.setTitle('tspace.title');
  }

  left(iso: string) {
    return remaining(iso);
  }

  private done(key: string): void {
    this.busy.set(false);
    this.toast.show(this.i18n.translate(key));
    this.requests.reload();
    this.dash.reload();
    this.slots.reload();
  }

  act(r: CourseRequest, action: 'accept' | 'refuse' | 'tutor-cancel' | 'complete'): void {
    this.busy.set(true);
    this.api.act(r.id, action).subscribe({
      next: () => this.done(`tspace.done.${action}`),
      error: (e) => {
        this.busy.set(false);
        this.toast.show(errorMessage(e), 'err');
        this.requests.reload();
      },
    });
  }

  addSlot(): void {
    // L'heure saisie est celle de Tunis (UTC+1, sans heure d'été).
    const startsAt = new Date(`${this.day}T${this.time}:00+01:00`).toISOString();
    this.busy.set(true);
    this.api.addSlot(startsAt, this.duration).subscribe({
      next: () => this.done('tspace.slotAdded'),
      error: (e) => {
        this.busy.set(false);
        this.toast.show(errorMessage(e), 'err');
      },
    });
  }

  removeSlot(id: number): void {
    this.api.removeSlot(id).subscribe({
      next: () => this.done('tspace.slotRemoved'),
      error: (e) => this.toast.show(errorMessage(e), 'err'),
    });
  }

  saveRate(): void {
    this.busy.set(true);
    this.api.setRate(this.rateCode, Number(this.ratePrice)).subscribe({
      next: () => {
        this.busy.set(false);
        this.rates.reload();
        this.toast.show(this.i18n.translate('tspace.rateSaved'));
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.show(errorMessage(e), 'err');
      },
    });
  }
}
