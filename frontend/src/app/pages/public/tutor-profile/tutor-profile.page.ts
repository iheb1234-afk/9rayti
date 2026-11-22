import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { UI } from '../../../components';
import { FavoriteButtonComponent } from '../../../components/favorite-button/favorite-button.component';
import { RatingStarsComponent } from '../../../components/rating-stars/rating-stars.component';
import { ShareProfileComponent } from '../../../components/share-profile/share-profile.component';
import { ApiService } from '../../../core/api/api.service';
import { CourseRequest, Slot } from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { errorMessage } from '../../../core/http/error-message';
import { LangService } from '../../../core/i18n/lang.service';
import { celebrate, originOf } from '../../../core/motion/motion';
import { RevealDirective } from '../../../directives/reveal.directive';

const FEE = 3000;
const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' });

/** Profil public d'un tuteur et formulaire de réservation (sitemap : Profil › Demande). */
@Component({
  selector: 'app-tutor',
  imports: [
    RouterLink,
    FormsModule,
    TranslocoPipe,
    FavoriteButtonComponent,
    ShareProfileComponent,
    RatingStarsComponent,
    RevealDirective,
    ...UI,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tutor-profile.page.html',
  styleUrl: './tutor-profile.page.scss',
})
export class TutorProfilePage {
  readonly id = input.required<string>();
  readonly matiere = input<string>();
  protected readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  private readonly lang = inject(LangService);
  protected readonly fee = FEE;

  protected readonly tutor = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.tutor(params),
  });
  protected readonly subjectCode = signal('');
  protected message = '';
  protected readonly slotId = signal<number | null>(null);
  protected readonly payWith = signal<'credits' | 'carte'>('credits');
  protected readonly attachment = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sent = signal<CourseRequest | null>(null);

  protected readonly freeSlots = computed<Slot[]>(() =>
    (this.tutor.value()?.slots ?? []).filter((s) => !s.booked),
  );
  /** Créneaux libres regroupés par jour (heure de Tunis), pour un sélecteur plus lisible. */
  protected readonly days = computed(() => {
    const map = new Map<string, Slot[]>();
    for (const s of this.freeSlots()) {
      const k = DAY.format(new Date(s.startsAt));
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.entries()].map(([key, slots]) => ({ key, first: slots[0].startsAt, slots }));
  });
  protected readonly price = computed(() => {
    const t = this.tutor.value();
    return (
      t?.subjects.find((s) => s.code === this.subjectCode())?.pricePerHourMillimes ??
      t?.pricePerHourMillimes ??
      0
    );
  });
  protected readonly balanceShort = computed(() => {
    const b = this.auth.user()?.balanceMillimes;
    return this.payWith() === 'credits' && b !== undefined && b < this.price() + FEE;
  });

  constructor() {
    effect(() => {
      const t = this.tutor.value();
      if (!t) return;
      this.lang.setTitle('tutor.title', { name: `${t.firstName} ${t.lastInitial}` });
      const wanted = this.matiere();
      if (!this.subjectCode())
        this.subjectCode.set(
          t.subjects.find((s) => s.code === wanted)?.code ?? t.subjects[0]?.code ?? '',
        );
    });
  }

  protected pick(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0];
    this.attachment.set(f ? f.name.slice(0, 120) : '');
  }

  protected send(tutorId: string, event: Event): void {
    const slotId = this.slotId();
    if (!slotId) return;
    const origin = originOf(event);
    this.busy.set(true);
    this.error.set(null);
    this.api
      .createRequest({
        tutorId,
        subjectCode: this.subjectCode(),
        slotId,
        payWith: this.payWith(),
        attachmentName: this.attachment() || undefined,
        message: this.message || undefined,
      })
      .subscribe({
        next: (r) => {
          this.busy.set(false);
          this.sent.set(r);
          this.auth.refresh();
          void celebrate(origin);
        },
        error: (e) => {
          this.busy.set(false);
          this.error.set(errorMessage(e));
          if ((e as { status?: number }).status === 409) this.tutor.reload();
        },
      });
  }
}
