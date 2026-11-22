import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { UI } from '../../../components';
import { LangService } from '../../../core/i18n/lang.service';
import { celebrate, originOf } from '../../../core/motion/motion';
import { CountUpDirective } from '../../../directives/count-up.directive';
import { MagneticDirective } from '../../../directives/magnetic.directive';
import { RevealDirective } from '../../../directives/reveal.directive';
import { SplitTextDirective } from '../../../directives/split-text.directive';
import { TiltDirective } from '../../../directives/tilt.directive';
import { DtPipe } from '../../../pipes/dt.pipe';

/** Semaines par mois, en moyenne (52 / 12). */
const WEEKS = 52 / 12;
/** Le tuteur garde 100 % de ses cours particuliers et 80 % des sessions d'examen. */
const SESSION_SHARE = 0.8;

/** « Devenir tuteur » : avantages, conditions et simulateur de gains (sitemap : public). */
@Component({
  selector: 'app-become-tutor',
  imports: [
    RouterLink,
    FormsModule,
    TranslocoPipe,
    CountUpDirective,
    MagneticDirective,
    RevealDirective,
    SplitTextDirective,
    TiltDirective,
    ...UI,
  ],
  providers: [DtPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './become-tutor.page.html',
  styleUrl: './become-tutor.page.scss',
})
export class BecomeTutorPage {
  private readonly dt = inject(DtPipe);
  protected readonly money = (m: number) => this.dt.transform(Math.round(m / 1000) * 1000);

  protected readonly price = signal(20);
  protected readonly hours = signal(5);
  protected readonly sessions = signal(2);
  protected readonly places = signal(8);
  protected readonly placePrice = signal(12);

  protected readonly lessons = computed(() =>
    Math.round(this.hours() * WEEKS * this.price() * 1000),
  );
  protected readonly group = computed(() =>
    Math.round(this.sessions() * this.places() * this.placePrice() * SESSION_SHARE * 1000),
  );
  protected readonly total = computed(() => this.lessons() + this.group());
  protected readonly semester = computed(() => this.total() * 4);
  protected readonly lessonsPct = computed(() =>
    this.total() ? (this.lessons() / this.total()) * 100 : 0,
  );
  /** Petite récompense visuelle quand le total dépasse un palier. */
  protected readonly tier = computed(() =>
    this.total() >= 800_000 ? 3 : this.total() >= 400_000 ? 2 : 1,
  );

  protected readonly perks = [
    { key: 'price', icon: 'coins' },
    { key: 'hours', icon: 'calendar' },
    { key: 'paid', icon: 'shield-check' },
    { key: 'room', icon: 'video' },
    { key: 'cv', icon: 'award' },
    { key: 'groups', icon: 'users' },
  ];
  protected readonly faq = ['who', 'verify', 'fee', 'cancel', 'tax'];

  constructor() {
    inject(LangService).setTitle('become.title');
  }

  protected cheer(e: Event): void {
    void celebrate(originOf(e));
  }
}
