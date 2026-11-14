import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { ApiService, SearchFilters } from '../core/api.service';
import { errorMessage } from '../core/http';
import { LangService } from '../core/lang.service';
import { Lang, TutorCard } from '../core/models';
import { TutorCardComponent } from '../shared/tutor-card.component';
import { UI } from '../shared/ui';

type When = NonNullable<SearchFilters['when']>;
type Sort = NonNullable<SearchFilters['sort']>;

@Component({
  selector: 'app-search',
  imports: [RouterLink, TranslocoPipe, TutorCardComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="wrap">
    <h1 class="page-h">{{ 'search.title' | transloco }}</h1>

    <div class="res">
      <details class="card filters" [open]="!narrow">
        <summary><app-icon name="sliders-horizontal" /> {{ 'search.filters' | transloco }}</summary>
        <div class="fld">
          <label for="f-subject">{{ 'search.subject' | transloco }}</label>
          <select id="f-subject" [value]="f().subject ?? ''" (change)="set({ subject: $any($event.target).value || undefined })">
            <option value="">{{ 'search.allSubjects' | transloco }}</option>
            @for (s of subjects(); track s.code) { <option [value]="s.code" [selected]="s.code === f().subject">{{ s | subject }}</option> }
          </select>
        </div>
        <div class="fld">
          <label for="f-price">{{ 'search.maxPrice' | transloco }} : <b>{{ (f().maxPrice ?? 40) * 1000 | dt }}</b></label>
          <input id="f-price" type="range" min="10" max="40" step="1" [value]="f().maxPrice ?? 40"
            (input)="set({ maxPrice: +$any($event.target).value === 40 ? undefined : +$any($event.target).value })" />
        </div>
        <fieldset>
          <legend class="lbl">{{ 'search.minRating' | transloco }}</legend>
          <div class="chips">
            @for (r of [0, 4, 4.5]; track r) {
              <button type="button" class="chip" [attr.aria-pressed]="(f().minRating ?? 0) === r" (click)="set({ minRating: r || undefined })">
                {{ r ? '★ ' + r + '+' : ('search.any' | transloco) }}</button>
            }
          </div>
        </fieldset>
        <fieldset>
          <legend class="lbl">{{ 'search.when' | transloco }}</legend>
          <div class="chips">
            @for (w of whens; track w) {
              <button type="button" class="chip" [attr.aria-pressed]="f().when === w" (click)="set({ when: f().when === w ? undefined : w })">{{ 'search.w.' + w | transloco }}</button>
            }
          </div>
        </fieldset>
        <fieldset>
          <legend class="lbl">{{ 'search.lang' | transloco }}</legend>
          <div class="chips">
            @for (l of langs; track l) {
              <button type="button" class="chip" [attr.aria-pressed]="f().lang === l" (click)="set({ lang: f().lang === l ? undefined : l })">{{ 'langs.' + l | transloco }}</button>
            }
          </div>
        </fieldset>
        <button type="button" class="linkbtn small" (click)="reset()">{{ 'search.reset' | transloco }}</button>
      </details>

      <section aria-labelledby="res-h">
        <div class="between top">
          <h2 id="res-h" class="small muted count" aria-live="polite">
            @if (state().loading) { {{ 'common.loading' | transloco }} } @else { {{ 'search.count' | transloco: { n: state().list.length } }} }
          </h2>
          <label class="sort small">{{ 'search.sort' | transloco }}
            <select [value]="f().sort ?? 'pertinence'" (change)="set({ sort: $any($event.target).value })">
              @for (s of sorts; track s) { <option [value]="s" [selected]="(f().sort ?? 'pertinence') === s">{{ 'search.s.' + s | transloco }}</option> }
            </select>
          </label>
        </div>

        @if (session(); as s) {
          <a class="sessrow" routerLink="/sessions">
            <span class="badge sun"><app-icon name="users" />{{ 'sessions.group' | transloco }}</span>
            <div class="grow"><b>{{ 'search.sessionHint' | transloco: { subject: (s.subject | subject) } }}</b>
              <div class="small muted">{{ s.startsAt | when }} · {{ 'sessions.places' | transloco: { n: s.placesTaken, max: s.placesMax } }}</div></div>
            <b>{{ s.pricePerPlaceMillimes | dt }}</b>
          </a>
        }

        @if (state().error; as e) { <div class="alert err" role="alert"><app-icon name="triangle-alert" />{{ e }}</div> }

        @if (state().loading) {
          @for (i of [1, 2, 3]; track i) { <div class="skeleton" style="height:118px;margin-bottom:14px"></div> }
        } @else {
          @for (t of state().list; track t.id) {
            <app-tutor-card [tutor]="t" [subject]="f().subject ?? ''" />
          } @empty {
            @if (!state().error) {
              <div class="empty">
                <div class="arcbig"><app-icon name="search-x" /></div>
                <h2>{{ 'search.emptyT' | transloco }}</h2>
                <p class="muted" style="margin:8px 0 18px">{{ 'search.emptyD' | transloco }}</p>
                <button type="button" class="btn alt" (click)="reset()">{{ 'search.reset' | transloco }}</button>
              </div>
            }
          }
        }
      </section>
    </div>
  </div>`,
  styles: `
    .res { display: grid; grid-template-columns: 250px 1fr; gap: 28px; align-items: start; margin-top: 20px; }
    .filters { padding: 18px 20px; position: sticky; top: 88px; }
    .filters summary { font-weight: 600; color: var(--bleu-nuit); cursor: pointer; list-style: none; margin-bottom: 14px; display: flex; gap: 8px; align-items: center; }
    .filters summary::-webkit-details-marker { display: none; }
    fieldset { border: 0; padding: 0; margin: 0 0 16px; }
    .lbl { font-size: 14px; font-weight: 600; color: var(--bleu-nuit); margin-bottom: 6px; padding: 0; }
    input[type=range] { width: 100%; accent-color: var(--bleu); padding: 0; background: none; border: 0; }
    .top { margin-bottom: 12px; }
    .count { font-weight: 500; color: var(--gris); font-size: 14.5px; }
    .sort { display: flex; gap: 8px; align-items: center; color: var(--gris); }
    .sort select { border: 1px solid var(--trait); border-radius: 999px; padding: 6px 12px; background: var(--blanc); font: inherit; }
    .sessrow { display: flex; gap: 16px; align-items: center; padding: 16px 18px; margin-bottom: 14px; background: var(--soleil-clair); border: 1px solid #f1d99a; border-radius: var(--r-card); color: inherit; }
    .grow { flex: 1; }
    @media (max-width: 760px) {
      .res { grid-template-columns: 1fr; gap: 14px; margin-top: 12px; }
      .filters { position: static; }
      .filters:not([open]) summary { margin-bottom: 0; }
      .sessrow { flex-wrap: wrap; gap: 8px; }
    }
  `,
})
export class SearchPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly whens: When[] = ['semaine', 'soir', 'weekend'];
  protected readonly sorts: Sort[] = ['pertinence', 'prix', 'note'];
  protected readonly langs: Lang[] = ['fr', 'ar', 'en'];
  protected readonly narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
  protected readonly subjects = toSignal(this.api.subjects().pipe(catchError(() => of([]))), { initialValue: [] });

  /** Les filtres vivent dans l'URL : une recherche se partage et survit au rechargement. */
  protected readonly f = toSignal(
    this.route.queryParamMap.pipe(
      map((p): SearchFilters => ({
        subject: p.get('matiere') ?? undefined,
        maxPrice: p.get('prix') ? Number(p.get('prix')) : undefined,
        minRating: p.get('note') ? Number(p.get('note')) : undefined,
        lang: (p.get('langue') as Lang) ?? undefined,
        when: (p.get('moment') as When) ?? undefined,
        sort: (p.get('tri') as Sort) ?? undefined,
      })),
    ),
    { initialValue: {} as SearchFilters },
  );

  protected readonly state = toSignal(
    toObservable(this.f).pipe(
      debounceTime(150),
      switchMap((f) =>
        this.api.searchTutors(f).pipe(
          map((list) => ({ loading: false, list, error: null as string | null })),
          catchError((e) => of({ loading: false, list: [] as TutorCard[], error: errorMessage(e) })),
          startWith({ loading: true, list: [] as TutorCard[], error: null }),
        ),
      ),
    ),
    { initialValue: { loading: true, list: [] as TutorCard[], error: null } },
  );

  private readonly sessions = toSignal(this.api.examSessions().pipe(catchError(() => of([]))), { initialValue: [] });
  protected readonly session = computed(() => {
    const code = this.f().subject;
    return code ? this.sessions().find((s) => s.subject.code === code) ?? null : null;
  });

  constructor() {
    inject(LangService).setTitle('search.title');
  }

  set(patch: Partial<SearchFilters>): void {
    const next = { ...this.f(), ...patch };
    void this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        matiere: next.subject ?? null, prix: next.maxPrice ?? null, note: next.minRating ?? null,
        langue: next.lang ?? null, moment: next.when ?? null, tri: next.sort && next.sort !== 'pertinence' ? next.sort : null,
      },
    });
  }

  reset(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }
}
