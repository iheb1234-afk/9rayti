import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/http';
import { LangService } from '../core/lang.service';
import { ExamSession } from '../core/models';
import { ToastService, UI } from '../shared/ui';

/** Sessions d'examen en groupe : un tuteur, plusieurs étudiants, un prix par place plus bas. */
@Component({
  selector: 'app-sessions',
  imports: [RouterLink, TranslocoPipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="wrap">
    <h1 class="page-h">{{ 'sessions.title' | transloco }}</h1>
    <p class="muted lead">{{ 'sessions.lead' | transloco }}</p>

    <div class="grid">
      @for (s of list(); track s.id) {
        <article class="card sc">
          <div class="between"><span class="badge sun"><app-icon name="users" />{{ 'sessions.group' | transloco }}</span>
            <span class="badge" [class.sun]="!s.confirmed">{{ (s.confirmed ? 'sessions.confirmed' : 'sessions.waiting') | transloco }}</span></div>
          <h2 class="h3">{{ s.subject | subject }}</h2>
          <div class="small muted"><app-icon name="calendar" /> {{ s.startsAt | when }} · {{ s.durationMin / 60 }} {{ 'common.h' | transloco }}</div>
          <div class="small muted"><app-icon name="user" /> <bdi>{{ s.tutor.firstName }} {{ s.tutor.lastInitial }}</bdi></div>
          <div class="bar" role="progressbar" [attr.aria-valuenow]="s.placesTaken" aria-valuemin="0" [attr.aria-valuemax]="s.placesMax"
            [attr.aria-label]="'sessions.places' | transloco: { n: s.placesTaken, max: s.placesMax }"><i [style.width.%]="(s.placesTaken / s.placesMax) * 100"></i></div>
          <div class="small between"><span>{{ 'sessions.places' | transloco: { n: s.placesTaken, max: s.placesMax } }}</span>
            <span class="muted">{{ 'sessions.min' | transloco: { n: s.placesMin } }}</span></div>
          <div class="between foot">
            <div class="price">{{ s.pricePerPlaceMillimes | dt }} <small>{{ 'sessions.perPlace' | transloco }}</small></div>
            @if (s.booked) { <span class="badge"><app-icon name="circle-check" />{{ 'sessions.booked' | transloco }}</span> }
            @else if (s.placesTaken >= s.placesMax) { <span class="badge grey">{{ 'sessions.full' | transloco }}</span> }
            @else if (!auth.loggedIn()) { <a class="btn sm" routerLink="/connexion" [queryParams]="{ next: '/sessions' }">{{ 'sessions.book' | transloco }}</a> }
            @else if (auth.role() === 'etudiant') { <button type="button" class="btn sm" [disabled]="busy() === s.id" (click)="book(s)">{{ 'sessions.book' | transloco }}</button> }
          </div>
        </article>
      } @empty {
        @if (data.isLoading()) { @for (i of [1, 2, 3]; track i) { <div class="skeleton" style="height:240px"></div> } }
        @else { <p class="muted">{{ 'sessions.none' | transloco }}</p> }
      }
    </div>
    <div class="banner"><app-icon name="info" /><div class="small">{{ 'sessions.rule' | transloco }}</div></div>
  </div>`,
  styles: `
    .lead { max-width: 640px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 24px; }
    .sc { padding: 20px; display: flex; flex-direction: column; gap: 6px; }
    .h3 { font-size: 19px; margin-top: 8px; }
    .foot { margin-top: 10px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
  `,
})
export class SessionsPage {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  protected readonly data = rxResource({
    params: () => this.auth.role(),
    stream: ({ params }) => (params === 'etudiant' ? this.api.myExamSessions() : this.api.examSessions()),
  });
  protected readonly list = computed<ExamSession[]>(() => this.data.value() ?? []);
  protected readonly busy = signal<string | null>(null);

  constructor() {
    inject(LangService).setTitle('sessions.title');
  }

  book(s: ExamSession): void {
    this.busy.set(s.id);
    this.api.bookExam(s.id).subscribe({
      next: () => { this.busy.set(null); this.data.reload(); this.auth.refresh(); this.toast.show(this.i18n.translate('sessions.bookedToast')); },
      error: (e) => { this.busy.set(null); this.toast.show(errorMessage(e), 'err'); },
    });
  }
}
