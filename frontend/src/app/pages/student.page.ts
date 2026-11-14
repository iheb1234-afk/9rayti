import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/http';
import { LangService } from '../core/lang.service';
import { CourseRequest } from '../core/models';
import { StateBadgeComponent, remaining } from '../shared/state-badge.component';
import { ToastService, UI } from '../shared/ui';

type Tab = 'cours' | 'historique' | 'credits' | 'sessions';
const UPCOMING = new Set(['en_attente', 'acceptee', 'faite']);

@Component({
  selector: 'app-student',
  imports: [RouterLink, FormsModule, NgTemplateOutlet, TranslocoPipe, StateBadgeComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="wrap">
    <div class="between page-h">
      <div><h1>{{ 'student.hello' | transloco: { name: auth.user()?.firstName } }}</h1>
        <p class="muted">{{ 'student.sub' | transloco }}</p></div>
      <a class="btn" routerLink="/recherche"><app-icon name="search" /> {{ 'nav.find' | transloco }}</a>
    </div>

    <div class="tiles" style="margin-top:22px">
      <div class="card tile main">
        <h3>{{ 'student.next' | transloco }}</h3>
        @if (nextCourse(); as n) {
          <div class="big w">{{ n.subject | subject }}</div>
          <div class="muted">{{ n.startsAt | when }} · <bdi>{{ n.tutor.firstName }} {{ n.tutor.lastInitial }}</bdi></div>
          <a class="btn sm" [routerLink]="['/salle', n.id]"><app-icon name="video" /> {{ 'student.enter' | transloco }}</a>
        } @else {
          <p class="muted" style="margin-top:6px">{{ 'student.noNext' | transloco }}</p>
          <a class="btn sm" routerLink="/recherche">{{ 'nav.find' | transloco }}</a>
        }
      </div>
      <div class="card tile">
        <h3 class="muted small">{{ 'student.balance' | transloco }}</h3>
        <div class="big">{{ credits.value()?.balanceMillimes ?? auth.user()?.balanceMillimes | dt }}</div>
        <button type="button" class="linkbtn small" (click)="tab.set('credits')">{{ 'student.recharge' | transloco }}</button>
      </div>
      <div class="card tile">
        <h3 class="muted small">{{ 'student.pending' | transloco }}</h3>
        <div class="big">{{ pendingCount() }}</div>
        <span class="small muted">{{ 'student.pendingHint' | transloco }}</span>
      </div>
    </div>

    <div class="dtabs" role="tablist" [attr.aria-label]="'student.tabs' | transloco">
      @for (t of tabs; track t) {
        <button type="button" role="tab" [id]="'tab-' + t" [attr.aria-selected]="tab() === t" [attr.aria-controls]="'panel-' + t" (click)="tab.set(t)">
          {{ 'student.tab.' + t | transloco }}
          @if (t === 'cours' && upcoming().length) { <span class="cnt">{{ upcoming().length }}</span> }
        </button>
      }
    </div>

    <section role="tabpanel" [id]="'panel-' + tab()" [attr.aria-labelledby]="'tab-' + tab()">
      @if (requests.error()) { <div class="alert err" role="alert">{{ err(requests.error()) }}</div> }
      @switch (tab()) {
        @case ('cours') {
          @for (r of upcoming(); track r.id) { <ng-container *ngTemplateOutlet="row; context: { $implicit: r }" /> }
          @empty {
            @if (!requests.isLoading()) {
              <div class="empty"><div class="arcbig"><app-icon name="inbox" /></div><h2>{{ 'student.emptyT' | transloco }}</h2>
                <p class="muted" style="margin:8px 0 18px">{{ 'student.emptyD' | transloco }}</p><a class="btn" routerLink="/recherche">{{ 'nav.find' | transloco }}</a></div>
            }
          }
        }
        @case ('historique') {
          @for (r of history(); track r.id) { <ng-container *ngTemplateOutlet="row; context: { $implicit: r }" /> }
          @empty { <p class="muted" style="padding:24px 0">{{ 'student.noHistory' | transloco }}</p> }
        }
        @case ('credits') {
          <div class="card box">
            <div class="between"><div><h2 class="h3">{{ 'student.recharge' | transloco }}</h2><p class="small muted">{{ 'student.rechargeD' | transloco }}</p></div>
              <div class="row">@for (a of [10, 20, 50]; track a) { <button type="button" class="btn sm alt" [disabled]="busy()" (click)="recharge(a)">+ {{ a * 1000 | dt }}</button> }</div></div>
          </div>
          <div class="card box">
            <h2 class="h3">{{ 'student.movements' | transloco }}</h2>
            @for (m of credits.value()?.movements ?? []; track m.id) {
              <div class="tline"><div><b>{{ m.label }}</b><div class="small muted">{{ m.createdAt | when }} · {{ 'credit.' + m.reason | transloco }}</div></div>
                <b [class.plus]="m.amountMillimes > 0">{{ m.amountMillimes > 0 ? '+' : '−' }}{{ (m.amountMillimes < 0 ? -m.amountMillimes : m.amountMillimes) | dt: 1 }}</b></div>
            } @empty { <p class="muted small">{{ 'student.noMovements' | transloco }}</p> }
          </div>
        }
        @case ('sessions') {
          @for (s of mySessions(); track s.id) {
            <div class="card lrow"><span class="badge sun"><app-icon name="users" /></span>
              <div class="mid"><b>{{ s.subject | subject }}</b><div class="small muted">{{ s.startsAt | when }} · {{ s.durationMin / 60 }} {{ 'common.h' | transloco }} · <bdi>{{ s.tutor.firstName }} {{ s.tutor.lastInitial }}</bdi></div></div>
              <span class="badge" [class.sun]="!s.confirmed">{{ (s.confirmed ? 'sessions.confirmed' : 'sessions.waiting') | transloco }}</span></div>
          } @empty {
            <p class="muted" style="padding:24px 0">{{ 'student.noSessions' | transloco }} <a routerLink="/sessions">{{ 'nav.sessions' | transloco }}</a></p>
          }
        }
      }
    </section>
  </div>

  <ng-template #row let-r>
    <article class="card lrow">
      <app-arc [name]="r.tutor.firstName + ' ' + r.tutor.lastInitial" [size]="44" />
      <div class="mid">
        <div class="row"><b>{{ r.subject | subject }}</b> <app-state [state]="r.state" /></div>
        <div class="small muted">{{ r.startsAt | when }} · <bdi>{{ r.tutor.firstName }} {{ r.tutor.lastInitial }}</bdi> · {{ r.totalMillimes | dt }}
          @if (r.payWith === 'credits') { ({{ 'book.credits' | transloco }}) }</div>
        @if (r.state === 'en_attente' && left(r.expiresAt); as t) {
          <span class="timer"><app-icon name="hourglass" /> {{ 'student.answerIn' | transloco: { h: t.h, m: t.m } }}</span>
        }
        @if (['refusee', 'expiree', 'annulee', 'annulee_tuteur'].includes(r.state)) {
          <span class="small refund"><app-icon name="wallet" /> {{ 'student.refunded' | transloco: { amount: (r.totalMillimes | dt) } }}</span>
        }
        @if (r.review) { <span class="small"><span class="star">{{ '★'.repeat(r.review.rating) }}</span> {{ 'student.reviewed' | transloco }}</span> }
      </div>
      <div class="acts">
        @if (['acceptee', 'faite', 'versee', 'signalee'].includes(r.state)) {
          <a class="btn sm" [routerLink]="['/salle', r.id]"><app-icon name="video" /> {{ 'student.room' | transloco }}</a>
        }
        @if (r.state === 'en_attente') { <button type="button" class="btn sm ghost" [disabled]="busy()" (click)="cancel(r)">{{ 'common.cancel' | transloco }}</button> }
        @if (r.canReview) { <button type="button" class="btn sm alt" (click)="openReview(r)"><app-icon name="star" /> {{ 'student.rate' | transloco }}</button> }
        @if (r.canReport) { <button type="button" class="btn sm ghost" (click)="openReport(r)"><app-icon name="flag" /> {{ 'student.report' | transloco }}</button> }
      </div>
    </article>
  </ng-template>

  <dialog #reviewDlg class="modal" aria-labelledby="rv-h" (close)="target.set(null)">
    <form class="mbody" method="dialog" (submit)="$event.preventDefault(); sendReview()">
      <h2 id="rv-h" class="h3">{{ 'student.rateT' | transloco }}</h2>
      <p class="small muted">{{ target()?.subject | subject }} · <bdi>{{ target()?.tutor?.firstName }}</bdi></p>
      <div class="stars" role="radiogroup" [attr.aria-label]="'student.rateT' | transloco">
        @for (n of [1, 2, 3, 4, 5]; track n) {
          <button type="button" role="radio" [attr.aria-checked]="rating() === n" [class.on]="n <= rating()" [attr.aria-label]="n + ' / 5'" (click)="rating.set(n)">★</button>
        }
      </div>
      <div class="fld" style="margin-top:12px"><label for="rv-c">{{ 'student.comment' | transloco }}</label><textarea id="rv-c" [(ngModel)]="comment" name="comment" maxlength="500"></textarea></div>
      <div class="row end"><button type="button" class="btn ghost sm" (click)="reviewDlg.close()">{{ 'common.close' | transloco }}</button>
        <button type="submit" class="btn sm" [disabled]="busy()">{{ 'common.send' | transloco }}</button></div>
    </form>
  </dialog>

  <dialog #reportDlg class="modal" aria-labelledby="rp-h" (close)="target.set(null)">
    <form class="mbody" (submit)="$event.preventDefault(); sendReport()">
      <h2 id="rp-h" class="h3">{{ 'student.reportT' | transloco }}</h2>
      <p class="small muted">{{ 'student.reportD' | transloco }}</p>
      <div class="fld" style="margin-top:12px"><label for="rp-r">{{ 'student.reason' | transloco }}</label><textarea id="rp-r" [(ngModel)]="reason" name="reason" minlength="5" maxlength="500" required></textarea></div>
      <div class="row end"><button type="button" class="btn ghost sm" (click)="reportDlg.close()">{{ 'common.close' | transloco }}</button>
        <button type="submit" class="btn sm danger" [disabled]="busy() || reason.trim().length < 5">{{ 'student.report' | transloco }}</button></div>
    </form>
  </dialog>`,
  styles: `
    .w { color: #fff !important; font-size: 24px !important; margin-top: 4px; }
    .box { padding: 22px; margin-top: 16px; }
    .h3 { font-size: 18px; margin-bottom: 6px; }
    .tline { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--trait); }
    .tline:last-child { border-bottom: 0; }
    .plus { color: var(--olivier); }
    .refund { color: var(--olivier); display: inline-flex; gap: 5px; align-items: center; }
    .end { justify-content: flex-end; margin-top: 8px; }
  `,
})
export class StudentPage {
  readonly onglet = input<string>();
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  protected readonly tabs: Tab[] = ['cours', 'historique', 'credits', 'sessions'];
  /** L'onglet suit ?onglet= dans l'URL, puis les clics. */
  protected readonly tab = linkedSignal<Tab>(() => ((this.tabs as string[]).includes(this.onglet() ?? '') ? (this.onglet() as Tab) : 'cours'));

  protected readonly requests = rxResource({ stream: () => this.api.myRequests() });
  protected readonly credits = rxResource({ stream: () => this.api.credits() });
  private readonly sessions = rxResource({ stream: () => this.api.myExamSessions() });

  protected readonly upcoming = computed(() =>
    (this.requests.value() ?? []).filter((r) => UPCOMING.has(r.state) && !(r.state === 'faite' && !r.canReview && !r.canReport))
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
  );
  protected readonly history = computed(() => (this.requests.value() ?? []).filter((r) => !this.upcoming().includes(r)));
  protected readonly pendingCount = computed(() => (this.requests.value() ?? []).filter((r) => r.state === 'en_attente').length);
  protected readonly nextCourse = computed(() =>
    this.upcoming().find((r) => r.state === 'acceptee' && +new Date(r.startsAt) > Date.now() - 2 * 3600_000) ?? null,
  );
  protected readonly mySessions = computed(() => (this.sessions.value() ?? []).filter((s) => s.booked));

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

  left(iso: string) { return remaining(iso); }
  err(e: unknown) { return errorMessage(e); }

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
      error: (e) => { this.busy.set(false); this.toast.show(errorMessage(e), 'err'); },
    });
  }

  cancel(r: CourseRequest): void { this.run(this.api.cancel(r.id), 'student.cancelled'); }

  openReview(r: CourseRequest): void { this.target.set(r); this.rating.set(5); this.comment = ''; this.reviewDlg().nativeElement.showModal(); }
  sendReview(): void {
    const r = this.target();
    if (r) this.run(this.api.review(r.id, this.rating(), this.comment), 'student.thanks', () => this.reviewDlg().nativeElement.close());
  }

  openReport(r: CourseRequest): void { this.target.set(r); this.reason = ''; this.reportDlg().nativeElement.showModal(); }
  sendReport(): void {
    const r = this.target();
    if (r) this.run(this.api.report(r.id, this.reason.trim()), 'student.reported', () => this.reportDlg().nativeElement.close());
  }

  recharge(dt: number): void {
    this.busy.set(true);
    this.api.recharge(dt).subscribe({
      next: () => { this.busy.set(false); this.credits.reload(); this.auth.refresh(); this.toast.show(this.i18n.translate('student.recharged')); },
      error: (e) => { this.busy.set(false); this.toast.show(errorMessage(e), 'err'); },
    });
  }
}
