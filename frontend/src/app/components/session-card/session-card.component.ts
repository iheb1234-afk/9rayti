import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ExamSession } from '../../core/api/models';
import { TiltDirective } from '../../directives/tilt.directive';
import { DtPipe } from '../../pipes/dt.pipe';
import { SubjectPipe } from '../../pipes/subject.pipe';
import { WhenPipe } from '../../pipes/when.pipe';
import { IconComponent } from '../icon/icon.component';

/** Carte d'une session d'examen en groupe : places restantes, prix par place, lien vers le détail. */
@Component({
  selector: 'app-session-card',
  imports: [RouterLink, TranslocoPipe, IconComponent, TiltDirective, DtPipe, SubjectPipe, WhenPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@let s = session();
    <a class="card sc" [routerLink]="['/sessions', s.id]" appTilt="6">
      <div class="between">
        <span class="badge sun"><app-icon name="users" />{{ 'sessions.group' | transloco }}</span>
        @if (s.booked) {
          <span class="badge"
            ><app-icon name="circle-check" />{{ 'sessions.booked' | transloco }}</span
          >
        } @else if (s.confirmed) {
          <span class="badge">{{ 'sessions.confirmed' | transloco }}</span>
        }
      </div>
      <h3>{{ s.subject | subject }}</h3>
      <div class="small muted">
        <bdi
          >{{ s.startsAt | when }} · {{ s.durationMin / 60 }} {{ 'common.h' | transloco }} ·
          {{ s.tutor.firstName }} {{ s.tutor.lastInitial }}</bdi
        >
      </div>
      <div
        class="bar"
        role="progressbar"
        [attr.aria-valuenow]="s.placesTaken"
        aria-valuemin="0"
        [attr.aria-valuemax]="s.placesMax"
        [attr.aria-label]="'sessions.places' | transloco: { n: s.placesTaken, max: s.placesMax }"
      >
        <i [style.width.%]="fill()"></i
        ><b class="min" [style.inset-inline-start.%]="minAt()" aria-hidden="true"></b>
      </div>
      <div class="small between">
        <span>{{ 'sessions.places' | transloco: { n: s.placesTaken, max: s.placesMax } }}</span
        ><b class="price-s">{{ s.pricePerPlaceMillimes | dt }}</b>
      </div>
    </a>`,
  styles: `
    .sc {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 18px;
      color: inherit;
      text-decoration: none !important;
      height: 100%;
    }
    .sc:hover {
      border-color: var(--lien);
    }
    h3 {
      margin-top: 10px;
    }
    .bar {
      position: relative;
      overflow: visible;
    }
    .bar i {
      border-radius: 9px;
      transition: width 1.2s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .min {
      position: absolute;
      top: -3px;
      width: 2px;
      height: 12px;
      background: var(--gris);
      opacity: 0.45;
      border-radius: 2px;
    }
    .price-s {
      color: var(--bleu-nuit);
    }
  `,
})
export class SessionCardComponent {
  readonly session = input.required<ExamSession>();
  protected readonly fill = computed(
    () => (this.session().placesTaken / this.session().placesMax) * 100,
  );
  protected readonly minAt = computed(
    () => (this.session().placesMin / this.session().placesMax) * 100,
  );
}
