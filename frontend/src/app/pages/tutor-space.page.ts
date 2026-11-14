import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { catchError, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/http';
import { LangService } from '../core/lang.service';
import { CourseRequest } from '../core/models';
import { StateBadgeComponent, remaining } from '../shared/state-badge.component';
import { ToastService, UI } from '../shared/ui';

type Tab = 'demandes' | 'cours' | 'creneaux' | 'tarifs';

@Component({
  selector: 'app-tutor-space',
  imports: [RouterLink, FormsModule, TranslocoPipe, StateBadgeComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="wrap">
    <div class="between page-h">
      <div><h1>{{ 'student.hello' | transloco: { name: auth.user()?.firstName } }}</h1><p class="muted">{{ 'tspace.sub' | transloco }}</p></div>
      @if (auth.user()?.tutorProfileId && dash.value()?.status === 'valide') {
        <a class="btn alt" [routerLink]="['/tuteurs', auth.user()!.tutorProfileId]"><app-icon name="eye" /> {{ 'tspace.publicProfile' | transloco }}</a>
      }
    </div>

    @if (dash.value()?.status === 'en_attente') {
      <div class="banner" role="status"><app-icon name="hourglass" /><div><b>{{ 'tspace.pendingT' | transloco }}</b><div class="small">{{ 'tspace.pendingD' | transloco }}</div></div></div>
    }

    <div class="tiles" style="margin-top:22px">
      <div class="card tile main">
        <h3>{{ 'tspace.next' | transloco }}</h3>
        @if (dash.value()?.nextCourse; as n) {
          <div class="big w">{{ n.subject | subject }}</div>
          <div class="muted">{{ n.startsAt | when }} · <bdi>{{ n.student.firstName }}</bdi> ({{ n.student.school }})</div>
          <a class="btn sm" [routerLink]="['/salle', n.id]"><app-icon name="video" /> {{ 'student.enter' | transloco }}</a>
        } @else { <p class="muted" style="margin-top:6px">{{ 'tspace.noNext' | transloco }}</p> }
      </div>
      <div class="card tile">
        <h3 class="muted small">{{ 'tspace.earned' | transloco }}</h3>
        <div class="big">{{ dash.value()?.earnedThisMonthMillimes ?? 0 | dt }}</div>
        <span class="small muted">{{ 'tspace.pendingPayout' | transloco: { amount: (dash.value()?.pendingPayoutMillimes ?? 0 | dt) } }}</span>
      </div>
      <div class="card tile">
        <h3 class="muted small">{{ 'tspace.reputation' | transloco }}</h3>
        <div class="big">@if (dash.value()?.rating; as r) { <span class="star">★</span> {{ r | num }} } @else { <span class="badge sun">{{ 'common.new' | transloco }}</span> }</div>
        <span class="small muted">{{ 'tspace.rate' | transloco: { n: dash.value()?.responseRate ?? 100 } }}</span>
      </div>
    </div>

    <div class="dtabs" role="tablist">
      @for (t of tabs; track t) {
        <button type="button" role="tab" [id]="'tt-' + t" [attr.aria-selected]="tab() === t" [attr.aria-controls]="'tp-' + t" (click)="tab.set(t)">
          {{ 'tspace.tab.' + t | transloco }} @if (t === 'demandes' && pending().length) { <span class="cnt">{{ pending().length }}</span> }</button>
      }
    </div>

    <section role="tabpanel" [id]="'tp-' + tab()" [attr.aria-labelledby]="'tt-' + tab()">
      @switch (tab()) {
        @case ('demandes') {
          <p class="small muted hint"><app-icon name="info" /> {{ 'tspace.ruleHint' | transloco }}</p>
          @for (r of pending(); track r.id) {
            <article class="card lrow">
              <app-arc [name]="r.student.firstName" [size]="44" />
              <div class="mid">
                <div class="row"><b>{{ r.subject | subject }}</b> · <bdi>{{ r.student.firstName }}</bdi> <span class="small muted">({{ r.student.school }})</span></div>
                <div class="small muted">{{ r.startsAt | when }} · {{ r.durationMin }} min · {{ 'tspace.youGet' | transloco: { amount: (r.amountMillimes | dt) } }}</div>
                @if (r.attachmentName) { <div class="small"><app-icon name="paperclip" /> {{ r.attachmentName }}</div> }
                @if (r.message) { <div class="small quote">« {{ r.message }} »</div> }
                @if (left(r.expiresAt); as t) { <span class="timer"><app-icon name="hourglass" /> {{ 'tspace.answerWithin' | transloco: { h: t.h, m: t.m } }}</span> }
              </div>
              <div class="acts">
                <button type="button" class="btn sm ok" [disabled]="busy()" (click)="act(r, 'accept')"><app-icon name="check" /> {{ 'tspace.accept' | transloco }}</button>
                <button type="button" class="btn sm ghost" [disabled]="busy()" (click)="act(r, 'refuse')">{{ 'tspace.refuse' | transloco }}</button>
              </div>
            </article>
          } @empty { <div class="empty"><div class="arcbig"><app-icon name="inbox" /></div><h2>{{ 'tspace.noRequests' | transloco }}</h2><p class="muted">{{ 'tspace.noRequestsD' | transloco }}</p></div> }
        }
        @case ('cours') {
          @for (r of courses(); track r.id) {
            <article class="card lrow">
              <app-arc [name]="r.student.firstName" [size]="44" />
              <div class="mid">
                <div class="row"><b>{{ r.subject | subject }}</b> · <bdi>{{ r.student.firstName }}</bdi> <app-state [state]="r.state" /></div>
                <div class="small muted">{{ r.startsAt | when }} · {{ r.amountMillimes | dt }}
                  @if (r.state === 'faite' && r.payoutAt) { · {{ 'tspace.payoutAt' | transloco: { when: (r.payoutAt | when) } }} }</div>
              </div>
              <div class="acts">
                @if (['acceptee', 'faite', 'versee', 'signalee'].includes(r.state)) { <a class="btn sm" [routerLink]="['/salle', r.id]"><app-icon name="video" /> {{ 'student.room' | transloco }}</a> }
                @if (r.state === 'acceptee') {
                  <button type="button" class="btn sm ok" [disabled]="busy()" (click)="act(r, 'complete')"><app-icon name="circle-check" /> {{ 'tspace.complete' | transloco }}</button>
                  <button type="button" class="btn sm ghost" [disabled]="busy()" (click)="act(r, 'tutor-cancel')">{{ 'tspace.cancel' | transloco }}</button>
                }
              </div>
            </article>
          } @empty { <p class="muted" style="padding:24px 0">{{ 'tspace.noCourses' | transloco }}</p> }
        }
        @case ('creneaux') {
          <form class="card box addslot" (ngSubmit)="addSlot()">
            <h2 class="h3">{{ 'tspace.addSlot' | transloco }}</h2>
            <div class="slotform">
              <div class="fld"><label for="s-day">{{ 'tspace.day' | transloco }}</label><input id="s-day" type="date" [(ngModel)]="day" name="day" [min]="today" required /></div>
              <div class="fld"><label for="s-time">{{ 'tspace.time' | transloco }}</label><input id="s-time" type="time" [(ngModel)]="time" name="time" step="1800" required /></div>
              <div class="fld"><label for="s-dur">{{ 'tspace.duration' | transloco }}</label>
                <select id="s-dur" [(ngModel)]="duration" name="duration">@for (d of [60, 90, 120]; track d) { <option [ngValue]="d">{{ d }} min</option> }</select></div>
              <button class="btn" type="submit" [disabled]="busy()"><app-icon name="calendar-plus" /> {{ 'common.add' | transloco }}</button>
            </div>
          </form>
          <div class="week">
            @for (d of week(); track d.key) {
              <div class="day"><b>{{ d.label }}</b>
                @for (s of d.slots; track s.id) {
                  <div class="ev" [class.cours]="s.booked" [class.free]="!s.booked">
                    <span>{{ s.startsAt | when: 'time' }}</span>
                    @if (!s.booked) { <button type="button" class="x" (click)="removeSlot(s.id)" [attr.aria-label]="('common.remove' | transloco) + ' ' + (s.startsAt | when)"><app-icon name="x" /></button> }
                    @else { <span class="small">{{ 'tspace.booked' | transloco }}</span> }
                  </div>
                } @empty { <span class="small muted">—</span> }
              </div>
            }
          </div>
        }
        @case ('tarifs') {
          <div class="card box">
            <h2 class="h3">{{ 'tspace.myRates' | transloco }}</h2>
            <p class="small muted">{{ 'tspace.ratesD' | transloco }}</p>
            @for (r of rates.value() ?? []; track r.code) {
              <div class="tline"><span>{{ r | subject }}</span><b>{{ r.pricePerHourMillimes | dt }} {{ 'common.perHour' | transloco }}</b></div>
            }
            <form class="slotform" style="margin-top:14px" (ngSubmit)="saveRate()">
              <div class="fld"><label for="t-sub">{{ 'search.subject' | transloco }}</label>
                <select id="t-sub" [(ngModel)]="rateCode" name="rateCode">@for (s of subjects(); track s.code) { <option [value]="s.code">{{ s | subject }}</option> }</select></div>
              <div class="fld"><label for="t-pr">{{ 'auth.pricePerHour' | transloco }}</label><input id="t-pr" type="number" min="5" max="100" [(ngModel)]="ratePrice" name="ratePrice" /></div>
              <button class="btn" type="submit" [disabled]="busy()">{{ 'common.save' | transloco }}</button>
            </form>
          </div>
        }
      }
    </section>
  </div>`,
  styles: `
    .w { color: #fff !important; font-size: 24px !important; margin-top: 4px; }
    .hint { display: flex; gap: 6px; align-items: center; margin: 14px 0 0; }
    .quote { color: var(--gris); font-style: italic; margin-top: 2px; }
    .box { padding: 22px; margin-top: 16px; }
    .h3 { font-size: 18px; margin-bottom: 8px; }
    .slotform { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
    .slotform .fld { margin: 0; min-width: 150px; flex: 1; }
    .slotform .btn { margin-bottom: 1px; }
    .tline { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--trait); }
    .week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-top: 16px; }
    .day { border: 1px solid var(--trait); border-radius: 10px; padding: 8px; min-height: 110px; font-size: 12.5px; background: var(--blanc); }
    .day > b { display: block; color: var(--gris); font-weight: 500; margin-bottom: 6px; }
    .ev { border-radius: 7px; padding: 3px 6px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; gap: 4px; }
    .ev.free { background: var(--olivier-clair); color: var(--olivier); }
    .ev.cours { background: var(--bleu); color: #fff; }
    .x { border: 0; background: none; color: inherit; padding: 0; display: inline-flex; }
    .x app-icon ::ng-deep .ic { width: 14px; height: 14px; }
    @media (max-width: 760px) { .week { grid-template-columns: repeat(2, 1fr); } }
  `,
})
export class TutorSpacePage {
  readonly onglet = input<string>();
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly lang = inject(LangService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  protected readonly tabs: Tab[] = ['demandes', 'cours', 'creneaux', 'tarifs'];
  protected readonly tab = linkedSignal<Tab>(() => ((this.tabs as string[]).includes(this.onglet() ?? '') ? (this.onglet() as Tab) : 'demandes'));

  protected readonly dash = rxResource({ stream: () => this.api.tutorDashboard() });
  protected readonly requests = rxResource({ stream: () => this.api.tutorRequests() });
  protected readonly slots = rxResource({ stream: () => this.api.mySlots() });
  protected readonly rates = rxResource({ stream: () => this.api.myRates() });
  protected readonly subjects = toSignal(this.api.subjects().pipe(catchError(() => of([]))), { initialValue: [] });

  protected readonly pending = computed(() => (this.requests.value() ?? []).filter((r) => r.state === 'en_attente'));
  protected readonly courses = computed(() =>
    (this.requests.value() ?? []).filter((r) => ['acceptee', 'faite', 'versee', 'signalee'].includes(r.state))
      .sort((a, b) => (a.state === 'acceptee' ? -1 : 0) - (b.state === 'acceptee' ? -1 : 0) || +new Date(b.startsAt) - +new Date(a.startsAt)),
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

  constructor() {
    this.lang.setTitle('tspace.title');
  }

  left(iso: string) { return remaining(iso); }

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
      error: (e) => { this.busy.set(false); this.toast.show(errorMessage(e), 'err'); this.requests.reload(); },
    });
  }

  addSlot(): void {
    // L'heure saisie est celle de Tunis (UTC+1, sans heure d'été).
    const startsAt = new Date(`${this.day}T${this.time}:00+01:00`).toISOString();
    this.busy.set(true);
    this.api.addSlot(startsAt, this.duration).subscribe({
      next: () => this.done('tspace.slotAdded'),
      error: (e) => { this.busy.set(false); this.toast.show(errorMessage(e), 'err'); },
    });
  }

  removeSlot(id: number): void {
    this.api.removeSlot(id).subscribe({ next: () => this.done('tspace.slotRemoved'), error: (e) => this.toast.show(errorMessage(e), 'err') });
  }

  saveRate(): void {
    this.busy.set(true);
    this.api.setRate(this.rateCode, Number(this.ratePrice)).subscribe({
      next: () => { this.busy.set(false); this.rates.reload(); this.toast.show(this.i18n.translate('tspace.rateSaved')); },
      error: (e) => { this.busy.set(false); this.toast.show(errorMessage(e), 'err'); },
    });
  }
}
