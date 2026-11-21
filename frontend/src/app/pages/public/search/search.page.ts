import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { ApiService, SearchFilters } from '../../../core/api/api.service';
import { errorMessage } from '../../../core/http/error-message';
import { LangService } from '../../../core/i18n/lang.service';
import { Lang, TutorCard } from '../../../core/api/models';
import { TutorCardComponent } from '../../../components/tutor-card/tutor-card.component';
import { UI } from '../../../components/index';

type When = NonNullable<SearchFilters['when']>;
type Sort = NonNullable<SearchFilters['sort']>;

@Component({
  selector: 'app-search',
  imports: [RouterLink, TranslocoPipe, TutorCardComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search.page.html',
  styleUrl: './search.page.scss',
})
export class SearchPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly whens: When[] = ['semaine', 'soir', 'weekend'];
  protected readonly sorts: Sort[] = ['pertinence', 'prix', 'note'];
  protected readonly langs: Lang[] = ['fr', 'ar', 'en'];
  protected readonly narrow =
    typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
  protected readonly subjects = toSignal(this.api.subjects().pipe(catchError(() => of([]))), {
    initialValue: [],
  });

  /** Les filtres vivent dans l'URL : une recherche se partage et survit au rechargement. */
  protected readonly f = toSignal(
    this.route.queryParamMap.pipe(
      map(
        (p): SearchFilters => ({
          subject: p.get('matiere') ?? undefined,
          maxPrice: p.get('prix') ? Number(p.get('prix')) : undefined,
          minRating: p.get('note') ? Number(p.get('note')) : undefined,
          lang: (p.get('langue') as Lang) ?? undefined,
          when: (p.get('moment') as When) ?? undefined,
          sort: (p.get('tri') as Sort) ?? undefined,
        }),
      ),
    ),
    { initialValue: {} as SearchFilters },
  );

  protected readonly state = toSignal(
    toObservable(this.f).pipe(
      debounceTime(150),
      switchMap((f) =>
        this.api.searchTutors(f).pipe(
          map((list) => ({ loading: false, list, error: null as string | null })),
          catchError((e) =>
            of({ loading: false, list: [] as TutorCard[], error: errorMessage(e) }),
          ),
          startWith({ loading: true, list: [] as TutorCard[], error: null }),
        ),
      ),
    ),
    { initialValue: { loading: true, list: [] as TutorCard[], error: null } },
  );

  private readonly sessions = toSignal(this.api.examSessions().pipe(catchError(() => of([]))), {
    initialValue: [],
  });
  protected readonly session = computed(() => {
    const code = this.f().subject;
    return code ? (this.sessions().find((s) => s.subject.code === code) ?? null) : null;
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
        matiere: next.subject ?? null,
        prix: next.maxPrice ?? null,
        note: next.minRating ?? null,
        langue: next.lang ?? null,
        moment: next.when ?? null,
        tri: next.sort && next.sort !== 'pertinence' ? next.sort : null,
      },
    });
  }

  reset(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }
}
