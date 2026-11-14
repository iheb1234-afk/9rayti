import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/http';
import { LangService } from '../core/lang.service';
import { CourseRequest, Slot } from '../core/models';
import { UI } from '../shared/ui';

const FEE = 3000;

@Component({
  selector: 'app-tutor',
  imports: [RouterLink, FormsModule, TranslocoPipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="wrap">
    <a routerLink="/recherche" [queryParams]="matiere() ? { matiere: matiere() } : {}" class="back small"><app-icon name="chevron-left" [flip]="true" /> {{ 'tutor.back' | transloco }}</a>

    @if (tutor.error()) {
      <div class="empty"><div class="arcbig"><app-icon name="search-x" /></div><h1>{{ 'tutor.notFound' | transloco }}</h1>
        <a class="btn" routerLink="/recherche" style="margin-top:16px">{{ 'nav.find' | transloco }}</a></div>
    } @else if (tutor.value(); as t) {
      <div class="prof">
        <div>
          <div class="phead">
            <app-arc [name]="t.firstName + ' ' + t.lastInitial" [size]="110" />
            <div>
              <div class="row"><h1><bdi>{{ t.firstName }} {{ t.lastInitial }}</bdi></h1>
                <span class="badge"><app-icon name="badge-check" />{{ 'common.verified' | transloco }}</span>
                @if (t.isNew) { <span class="badge sun">{{ 'common.new' | transloco }}</span> }</div>
              <div class="muted"><bdi>{{ t.school }} · {{ t.year }}</bdi></div>
              <div class="kpis">
                @if (t.rating !== null) { <span><span class="star" aria-hidden="true">★</span> <b>{{ t.rating | num }}</b> ({{ 'common.reviews' | transloco: { n: t.ratingCount } }})</span> }
                @else { <span>{{ 'tutor.newHint' | transloco }}</span> }
                <span><b>{{ t.hoursTaught }} h</b> {{ 'tutor.taught' | transloco }}</span>
                @if (t.responseRate !== null) { <span><b>{{ t.responseRate }} %</b> {{ 'tutor.responseRate' | transloco }}</span> }
                <span><app-icon name="languages" /> @for (l of t.languages; track l; let last = $last) {{{ 'langs.' + l | transloco }}@if (!last) {, }}</span>
              </div>
            </div>
          </div>

          <section class="card box"><h2 class="h3">{{ 'tutor.about' | transloco }}</h2><p class="bio">{{ t.bio }}</p>
            @if (t.declaredAverageVerified) { <p class="small muted verif"><app-icon name="shield-check" /> {{ 'tutor.verifiedNote' | transloco }}</p> }</section>

          <section class="card box"><h2 class="h3">{{ 'tutor.subjects' | transloco }}</h2>
            @for (s of t.subjects; track s.code) {
              <div class="tline"><span>{{ s | subject }}</span><b>{{ s.pricePerHourMillimes | dt }} {{ 'common.perHour' | transloco }}</b></div>
            }
          </section>

          <section class="card box"><h2 class="h3">{{ 'tutor.reviews' | transloco }} ({{ t.ratingCount }})</h2>
            @for (r of t.reviews; track $index) {
              <div class="rev"><div class="between"><b>{{ r.author }} · <span class="muted small">{{ r.subject | subject }}</span></b>
                <span class="star" [attr.aria-label]="r.rating + ' / 5'">{{ '★'.repeat(r.rating) }}</span></div>
                @if (r.comment) { <p class="small" style="margin-top:4px">{{ r.comment }}</p> }
                <div class="small muted">{{ r.date | when: 'short' }}</div></div>
            } @empty { <p class="muted small">{{ 'tutor.noReviews' | transloco }}</p> }
          </section>
        </div>

        <aside class="card book" id="reserver" aria-labelledby="book-h">
          @if (sent(); as r) {
            <div class="done" role="status">
              <span class="okc"><app-icon name="circle-check" /></span>
              <h2 class="h3">{{ 'book.sentT' | transloco }}</h2>
              <p class="small muted">{{ 'book.sentD' | transloco: { name: t.firstName, when: (r.expiresAt | when) } }}</p>
              <a class="btn block" routerLink="/mon-espace">{{ 'book.track' | transloco }}</a>
            </div>
          } @else {
            <h2 id="book-h" class="h3">{{ 'book.title' | transloco }}</h2>
            <div class="price big">{{ price() | dt }} <small>{{ 'common.perHour' | transloco }}</small></div>

            <div class="fld">
              <label for="b-subject">{{ 'search.subject' | transloco }}</label>
              <select id="b-subject" [(ngModel)]="subjectCode" name="subject">
                @for (s of t.subjects; track s.code) { <option [value]="s.code">{{ s | subject }}</option> }
              </select>
            </div>

            <div class="lbl" id="slots-l">{{ 'book.slot' | transloco }}</div>
            @if (freeSlots().length) {
              <div class="slots" role="radiogroup" aria-labelledby="slots-l">
                @for (s of freeSlots(); track s.id) {
                  <button type="button" role="radio" class="slot" [attr.aria-checked]="slotId() === s.id" [class.on]="slotId() === s.id" (click)="slotId.set(s.id)">
                    <b>{{ s.startsAt | when: 'day' }}</b>{{ s.startsAt | when: 'time' }}</button>
                }
              </div>
            } @else { <p class="small muted">{{ 'search.noSlot' | transloco }}</p> }

            <div class="fld">
              <label for="b-file" class="drop"><app-icon name="paperclip" />
                <span>{{ attachment() || ('book.attach' | transloco) }}</span></label>
              <input id="b-file" type="file" accept="application/pdf,image/*" class="sr-only" (change)="pick($event)" />
            </div>
            <div class="fld">
              <label for="b-msg">{{ 'book.message' | transloco }}</label>
              <textarea id="b-msg" [(ngModel)]="message" name="message" maxlength="500" [placeholder]="'book.messagePh' | transloco"></textarea>
            </div>

            <div class="lbl" id="pay-l">{{ 'book.pay' | transloco }}</div>
            <div class="pay" role="radiogroup" aria-labelledby="pay-l">
              <button type="button" role="radio" [attr.aria-checked]="payWith() === 'credits'" [class.on]="payWith() === 'credits'" (click)="payWith.set('credits')">
                <app-icon name="wallet" /> {{ 'book.credits' | transloco }}
                @if (auth.user()?.balanceMillimes != null) { <small>{{ auth.user()?.balanceMillimes | dt }}</small> }</button>
              <button type="button" role="radio" [attr.aria-checked]="payWith() === 'carte'" [class.on]="payWith() === 'carte'" (click)="payWith.set('carte')">
                <app-icon name="credit-card" /> {{ 'book.card' | transloco }}</button>
            </div>

            <div class="sum">
              <div><span>{{ 'book.lesson' | transloco }}</span><span>{{ price() | dt }}</span></div>
              <div><span>{{ 'book.fee' | transloco }}</span><span>{{ fee | dt }}</span></div>
              <div class="tot"><span>{{ 'book.total' | transloco }}</span><span>{{ price() + fee | dt }}</span></div>
            </div>

            @if (error()) { <div class="alert err" role="alert"><app-icon name="triangle-alert" /> {{ error() }}</div> }

            @if (!auth.loggedIn()) {
              <a class="btn block" routerLink="/connexion" [queryParams]="{ next: router.url }">{{ 'book.loginFirst' | transloco }}</a>
            } @else if (auth.role() !== 'etudiant') {
              <p class="alert info small">{{ 'book.studentsOnly' | transloco }}</p>
            } @else {
              <button type="button" class="btn block" [disabled]="!slotId() || busy()" (click)="send(t.id)">
                @if (busy()) { <app-icon name="loader-circle" /> } {{ 'book.send' | transloco }}</button>
            }
            <p class="rule"><app-icon name="info" /> {{ 'book.rule' | transloco }}</p>
          }
        </aside>
      </div>
    } @else {
      <div class="skeleton" style="height:340px;margin-top:28px"></div>
    }
  </div>`,
  styles: `
    .back { display: inline-flex; gap: 4px; align-items: center; margin-top: 22px; }
    .prof { display: grid; grid-template-columns: 1fr 380px; gap: 32px; align-items: start; margin-top: 18px; }
    .phead { display: flex; gap: 22px; align-items: center; }
    .phead h1 { font-size: 34px; }
    .kpis { display: flex; gap: 22px; margin-top: 10px; font-size: 14px; color: var(--gris); flex-wrap: wrap; }
    .kpis b { color: var(--texte); }
    .box { padding: 22px; margin-top: 20px; }
    .h3 { font-size: 18px; margin-bottom: 10px; }
    .bio { white-space: pre-line; }
    .verif { margin-top: 10px; display: flex; gap: 6px; align-items: center; color: var(--olivier); }
    .tline { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--trait); }
    .tline:last-child { border-bottom: 0; }
    .rev { padding: 14px 0; border-bottom: 1px solid var(--trait); }
    .rev:last-child { border-bottom: 0; }
    .book { padding: 22px; position: sticky; top: 88px; border: 1.5px solid var(--bleu); }
    .price.big { margin: -4px 0 14px; }
    .lbl { font-size: 14px; font-weight: 600; color: var(--bleu-nuit); margin-bottom: 6px; }
    .slots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0 0 14px; max-height: 196px; overflow-y: auto; padding: 3px; }
    .slot { border: 1px solid var(--trait); border-radius: 10px; padding: 8px 4px; text-align: center; font-size: 13.5px; background: var(--blanc); color: var(--texte); }
    .slot b { display: block; font-size: 12px; color: var(--gris); font-weight: 400; }
    .slot.on { border: 1.5px solid var(--bleu); background: var(--bleu-clair); color: var(--bleu-nuit); font-weight: 600; }
    .drop { border: 1.5px dashed #cbbf9f; border-radius: 10px; padding: 12px; display: flex !important; gap: 10px; align-items: center; font-size: 14px !important; font-weight: 400 !important; color: var(--gris) !important; cursor: pointer; margin: 0; }
    .drop:hover { border-color: var(--bleu); }
    input[type=file]:focus-visible + .drop, .fld:focus-within .drop { box-shadow: var(--focus); }
    .pay { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0 0 14px; }
    .pay button { border: 1px solid var(--trait); border-radius: 10px; padding: 9px; font-size: 13.5px; text-align: center; background: var(--blanc); color: var(--texte); display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .pay button small { color: var(--gris); }
    .pay button.on { border: 1.5px solid var(--bleu); background: var(--bleu-clair); color: var(--bleu-nuit); font-weight: 600; }
    .sum { font-size: 15px; margin-bottom: 12px; }
    .sum div { display: flex; justify-content: space-between; padding: 4px 0; }
    .sum .tot { border-top: 1px solid var(--trait); margin-top: 6px; padding-top: 10px; font-weight: 700; color: var(--bleu-nuit); font-size: 17px; }
    .rule { display: flex; gap: 8px; font-size: 13px; color: var(--gris); margin-top: 12px; }
    .done { text-align: center; }
    .okc { display: inline-flex; width: 56px; height: 56px; border-radius: 50%; background: var(--olivier-clair); color: var(--olivier); align-items: center; justify-content: center; margin-bottom: 10px; }
    .done p { margin: 6px 0 16px; }
    @media (max-width: 860px) {
      .prof { grid-template-columns: 1fr; }
      .book { position: static; }
      .phead { gap: 14px; }
      .phead h1 { font-size: 26px; }
    }
  `,
})
export class TutorPage {
  readonly id = input.required<string>();
  readonly matiere = input<string>();
  protected readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  private readonly lang = inject(LangService);
  protected readonly fee = FEE;

  protected readonly tutor = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.tutor(params) });
  protected subjectCodeSig = signal('');
  get subjectCode() { return this.subjectCodeSig(); }
  set subjectCode(v: string) { this.subjectCodeSig.set(v); }
  protected message = '';
  protected readonly slotId = signal<number | null>(null);
  protected readonly payWith = signal<'credits' | 'carte'>('credits');
  protected readonly attachment = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sent = signal<CourseRequest | null>(null);

  protected readonly freeSlots = computed<Slot[]>(() => (this.tutor.value()?.slots ?? []).filter((s) => !s.booked));
  protected readonly price = computed(() => {
    const t = this.tutor.value();
    return t?.subjects.find((s) => s.code === this.subjectCodeSig())?.pricePerHourMillimes ?? t?.pricePerHourMillimes ?? 0;
  });

  constructor() {
    effect(() => {
      const t = this.tutor.value();
      if (!t) return;
      this.lang.setTitle('tutor.title');
      const wanted = this.matiere();
      if (!this.subjectCodeSig()) this.subjectCodeSig.set(t.subjects.find((s) => s.code === wanted)?.code ?? t.subjects[0]?.code ?? '');
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
      .createRequest({ tutorId, subjectCode: this.subjectCodeSig(), slotId, payWith: this.payWith(), attachmentName: this.attachment() || undefined, message: this.message || undefined })
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
