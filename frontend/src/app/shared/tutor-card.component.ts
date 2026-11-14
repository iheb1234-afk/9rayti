import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LangService } from '../core/lang.service';
import { TutorCard } from '../core/models';
import { UI } from './ui';

/** Carte d'un tuteur dans les résultats de recherche. */
@Component({
  selector: 'app-tutor-card',
  imports: [RouterLink, TranslocoPipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  @let t = tutor();
  <article class="card tut">
    <app-arc [name]="t.firstName + ' ' + t.lastInitial" [size]="64" />
    <div class="mid">
      <div class="row1">
        <h3><a [routerLink]="['/tuteurs', t.id]" [queryParams]="subject() ? { matiere: subject() } : {}" class="stretch"><bdi>{{ t.firstName }} {{ t.lastInitial }}</bdi></a></h3>
        <span class="badge"><app-icon name="badge-check" />{{ 'common.verified' | transloco }}</span>
        @if (t.isNew) { <span class="badge sun">{{ 'common.new' | transloco }}</span> }
      </div>
      <div class="meta">
        <span><bdi>{{ t.school }} · {{ t.year }}</bdi></span>
        @if (t.rating !== null) {
          <span><span class="star" aria-hidden="true">★</span> {{ t.rating | num }} <span class="muted">({{ 'common.reviews' | transloco: { n: t.ratingCount } }})</span></span>
        }
        <span>{{ 'common.hours' | transloco: { n: t.hoursTaught } }}</span>
        @if (t.responseRate !== null) { <span>{{ 'common.responds' | transloco: { n: t.responseRate } }}</span> }
      </div>
      <div class="subj">
        @for (s of t.subjects; track s.code) { <span [class.hl]="s.code === subject()">{{ s | subject }}</span> }
      </div>
    </div>
    <div class="end">
      <div class="price">{{ t.pricePerHourMillimes | dt }} <small>{{ 'common.perHour' | transloco }}</small></div>
      @if (t.nextSlot) {
        <span class="small muted"><app-icon name="calendar" /> {{ t.nextSlot | when }}</span>
      } @else {
        <span class="small muted">{{ 'search.noSlot' | transloco }}</span>
      }
    </div>
  </article>`,
  styles: `
    .tut { display: flex; gap: 18px; padding: 18px; align-items: center; margin-bottom: 14px; position: relative; transition: border-color .15s, box-shadow .15s; }
    .tut:hover, .tut:focus-within { border-color: var(--bleu); box-shadow: 0 8px 24px rgba(11, 60, 120, .08); }
    .stretch { color: inherit; }
    .stretch::after { content: ''; position: absolute; inset: 0; border-radius: var(--r-card); }
    .stretch:focus-visible { box-shadow: none; }
    .stretch:focus-visible::after { box-shadow: var(--focus); }
    .mid { flex: 1; min-width: 0; }
    .row1 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .meta { display: flex; gap: 14px; flex-wrap: wrap; font-size: 14px; color: var(--gris); margin-top: 6px; }
    .subj { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
    .subj span { font-size: 13px; background: var(--fond); border: 1px solid var(--trait); border-radius: 8px; padding: 1px 8px; }
    .subj span.hl { background: var(--bleu-clair); border-color: #c3d4ec; color: var(--bleu-nuit); }
    .end { text-align: end; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
    @media (max-width: 760px) {
      .tut { flex-wrap: wrap; gap: 12px; padding: 14px; }
      .end { flex-direction: row; width: 100%; justify-content: space-between; align-items: center; }
    }
  `,
})
export class TutorCardComponent {
  readonly tutor = input.required<TutorCard>();
  readonly subject = input<string>('');
  protected readonly lang = inject(LangService);
  protected readonly x = computed(() => this.tutor().id);
}
