import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { catchError, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { LangService } from '../core/lang.service';
import { UI } from '../shared/ui';

@Component({
  selector: 'app-home',
  imports: [RouterLink, FormsModule, TranslocoPipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="wrap">
    <section class="hero">
      <div>
        <span class="badge blue">{{ 'home.kick' | transloco }}</span>
        <h1>{{ 'home.h1' | transloco }}</h1>
        <p class="lead">{{ 'home.lead' | transloco }}</p>

        <form class="q" role="search" (ngSubmit)="go()">
          <label class="sr-only" for="q-subject">{{ 'search.subject' | transloco }}</label>
          <div class="field">
            <app-icon name="search" />
            <select id="q-subject" name="subject" [(ngModel)]="subject">
              <option value="">{{ 'home.pick' | transloco }}</option>
              @for (s of subjects(); track s.code) { <option [value]="s.code">{{ s | subject }}</option> }
            </select>
          </div>
          <button class="btn" type="submit">{{ 'home.go' | transloco }}</button>
        </form>

        <div class="duo">
          <a class="btn big" routerLink="/recherche"><span>{{ 'home.cta1' | transloco }}</span><small>{{ 'home.cta1s' | transloco }}</small></a>
          <a class="btn big alt" routerLink="/inscription" [queryParams]="{ role: 'tuteur' }"><span>{{ 'home.cta2' | transloco }}</span><small>{{ 'home.cta2s' | transloco }}</small></a>
        </div>
      </div>

      <div class="door studs" aria-hidden="true">
        <div class="in"></div>
        <div class="sunbadge">{{ 'home.sun' | transloco }}</div>
        <div class="mini c1"><div class="card">
          <span class="arc" style="width:44px;height:52px">SB</span>
          <div style="flex:1;min-width:0"><div style="font-weight:600"><bdi>Sarra B.</bdi> <span class="badge"><app-icon name="badge-check" />{{ 'common.verified' | transloco }}</span></div>
          <div class="small muted"><bdi>SUP'COM · <span class="star">★</span> 4,9 · 42 h</bdi></div></div>
          <div class="price" style="font-size:17px">{{ 20000 | dt }}</div>
        </div></div>
        <div class="mini c2"><div class="card" style="gap:10px">
          <span style="color:var(--olivier)"><app-icon name="circle-check" /></span>
          <div class="small"><b>{{ 'home.accepted' | transloco }}</b><div class="muted">{{ 'home.acceptedSub' | transloco }}</div></div>
        </div></div>
      </div>
    </section>

    <section class="sec" aria-labelledby="how">
      <h2 id="how">{{ 'home.how' | transloco }}</h2>
      <ol class="steps">
        @for (n of [1, 2, 3]; track n) {
          <li class="card step"><div class="n" aria-hidden="true">{{ n }}</div><h3>{{ 'home.s' + n | transloco }}</h3><p class="muted small">{{ 'home.s' + n + 'd' | transloco }}</p></li>
        }
      </ol>
    </section>

    <section class="sec" aria-labelledby="sess">
      <div class="sec-h"><h2 id="sess">{{ 'home.sessions' | transloco }}</h2><a routerLink="/sessions" class="small">{{ 'common.seeAll' | transloco }}</a></div>
      <div class="sess">
        @for (s of sessions(); track s.id) {
          <a class="card sc" routerLink="/sessions">
            <span class="badge sun"><app-icon name="users" />{{ 'sessions.group' | transloco }}</span>
            <h3>{{ s.subject | subject }}</h3>
            <div class="small muted"><bdi>{{ s.startsAt | when }} · {{ s.durationMin / 60 }} {{ 'common.h' | transloco }} · {{ s.tutor.firstName }} {{ s.tutor.lastInitial }}</bdi></div>
            <div class="bar"><i [style.width.%]="(s.placesTaken / s.placesMax) * 100"></i></div>
            <div class="small between"><span>{{ 'sessions.places' | transloco: { n: s.placesTaken, max: s.placesMax } }}</span><b>{{ s.pricePerPlaceMillimes | dt }}</b></div>
          </a>
        } @empty {
          @for (i of [1, 2, 3]; track i) { <div class="skeleton" style="height:150px"></div> }
        }
      </div>
    </section>

    <section class="sec trust">
      <div><app-icon name="shield-check" /><div><b>{{ 'home.t1' | transloco }}</b><div class="small muted">{{ 'home.t1d' | transloco }}</div></div></div>
      <div><app-icon name="wallet" /><div><b>{{ 'home.t2' | transloco }}</b><div class="small muted">{{ 'home.t2d' | transloco }}</div></div></div>
      <div><app-icon name="play" /><div><b>{{ 'home.t3' | transloco }}</b><div class="small muted">{{ 'home.t3d' | transloco }}</div></div></div>
    </section>
  </div>`,
  styles: `
    .hero { display: grid; grid-template-columns: 1.1fr .9fr; gap: 48px; align-items: center; padding: 56px 0 40px; }
    h1 { margin-top: 14px; }
    .lead { font-size: 19px; color: var(--gris); max-width: 520px; margin: 16px 0 24px; }
    .q { display: flex; gap: 10px; max-width: 520px; margin-bottom: 18px; }
    .field { flex: 1; display: flex; align-items: center; gap: 10px; background: var(--blanc); border: 1.5px solid var(--bleu); border-radius: 999px; padding: 4px 6px 4px 18px; color: var(--bleu); }
    :host-context([dir=rtl]) .field { padding: 4px 18px 4px 6px; }
    .field select { flex: 1; border: 0; background: transparent; font: inherit; font-size: 16px; padding: 9px 0; color: var(--texte); min-width: 0; }
    .field select:focus { outline: none; }
    .field:focus-within { box-shadow: 0 0 0 3px var(--bleu-clair); }
    .duo { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; max-width: 520px; }
    .duo .btn { flex-direction: column; align-items: flex-start; gap: 2px; border-radius: 18px; padding: 16px 20px; white-space: normal; text-align: start; }
    .duo .btn small { font-weight: 400; font-size: 13px; opacity: .85; }
    .door { position: relative; height: 420px; border-radius: 220px 220px 22px 22px; background-color: var(--bleu); }
    .door .in { position: absolute; inset: 26px; border-radius: 200px 200px 14px 14px; border: 2px solid rgba(255, 255, 255, .35); }
    .mini { position: absolute; left: 50%; transform: translateX(-50%); width: 80%; }
    .mini.c1 { top: 150px; } .mini.c2 { top: 262px; width: 68%; }
    .mini .card { padding: 12px 14px; display: flex; gap: 12px; align-items: center; box-shadow: 0 10px 30px rgba(11, 60, 120, .25); }
    .sunbadge { position: absolute; top: 70px; inset-inline-end: -14px; background: var(--soleil); color: #3a2a05; font-weight: 700; border-radius: 999px; padding: 8px 14px; font-size: 14px; transform: rotate(6deg); }
    :host-context([dir=rtl]) .sunbadge { transform: rotate(-6deg); }
    .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin: 22px 0 0; padding: 0; list-style: none; }
    .step { padding: 22px; }
    .step .n { width: 34px; height: 34px; border-radius: 50%; background: var(--bleu-clair); color: var(--bleu); display: flex; align-items: center; justify-content: center; font-weight: 700; margin-bottom: 12px; }
    .step p { margin-top: 6px; }
    .sess { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 22px; }
    .sc { padding: 18px; color: inherit; text-decoration: none !important; transition: border-color .15s, transform .15s; }
    .sc:hover { border-color: var(--bleu); transform: translateY(-2px); }
    .sc h3 { margin-top: 10px; }
    .trust { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
    .trust > div { display: flex; gap: 12px; align-items: flex-start; padding: 18px; border-radius: var(--r-card); background: var(--chaux); }
    .trust app-icon ::ng-deep .ic { width: 24px; height: 24px; color: var(--bleu); }
    @media (max-width: 760px) {
      .hero { grid-template-columns: 1fr; gap: 28px; padding: 30px 0 10px; }
      .lead { font-size: 16.5px; margin: 12px 0 18px; }
      .duo, .steps, .sess, .trust { grid-template-columns: 1fr; gap: 12px; }
      .door { height: 320px; border-radius: 160px 160px 18px 18px; margin: 0 10px; }
      .door .in { inset: 18px; border-radius: 150px 150px 10px 10px; }
      .mini.c1 { top: 100px; width: 86%; } .mini.c2 { top: 206px; width: 76%; }
      .sunbadge { top: 40px; inset-inline-end: 0; }
    }
  `,
})
export class HomePage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected subject = '';
  protected readonly subjects = toSignal(this.api.subjects().pipe(catchError(() => of([]))), { initialValue: [] });
  protected readonly sessions = toSignal(this.api.examSessions().pipe(catchError(() => of([]))), { initialValue: [] });

  constructor() {
    inject(LangService).setTitle('home.title');
  }

  go(): void {
    void this.router.navigate(['/recherche'], { queryParams: this.subject ? { matiere: this.subject } : {} });
  }
}
