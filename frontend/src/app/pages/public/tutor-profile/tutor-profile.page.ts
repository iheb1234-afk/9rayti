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
import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { errorMessage } from '../../../core/http/error-message';
import { LangService } from '../../../core/i18n/lang.service';
import { CourseRequest, Slot } from '../../../core/api/models';
import { UI } from '../../../components/index';

const FEE = 3000;

@Component({
  selector: 'app-tutor',
  imports: [RouterLink, FormsModule, TranslocoPipe, ...UI],
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
  protected subjectCodeSig = signal('');
  get subjectCode() {
    return this.subjectCodeSig();
  }
  set subjectCode(v: string) {
    this.subjectCodeSig.set(v);
  }
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
  protected readonly price = computed(() => {
    const t = this.tutor.value();
    return (
      t?.subjects.find((s) => s.code === this.subjectCodeSig())?.pricePerHourMillimes ??
      t?.pricePerHourMillimes ??
      0
    );
  });

  constructor() {
    effect(() => {
      const t = this.tutor.value();
      if (!t) return;
      this.lang.setTitle('tutor.title');
      const wanted = this.matiere();
      if (!this.subjectCodeSig())
        this.subjectCodeSig.set(
          t.subjects.find((s) => s.code === wanted)?.code ?? t.subjects[0]?.code ?? '',
        );
    });
  }

  pick(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0];
    this.attachment.set(f ? f.name.slice(0, 120) : '');
  }

  send(tutorId: string): void {
    const slotId = this.slotId();
    if (!slotId) return;
    this.busy.set(true);
    this.error.set(null);
    this.api
      .createRequest({
        tutorId,
        subjectCode: this.subjectCodeSig(),
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
        },
        error: (e) => {
          this.busy.set(false);
          this.error.set(errorMessage(e));
          if ((e as { status?: number }).status === 409) this.tutor.reload();
        },
      });
  }
}
