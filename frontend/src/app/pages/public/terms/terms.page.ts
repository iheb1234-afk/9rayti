import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { UI } from '../../../components';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { LangService } from '../../../core/i18n/lang.service';
import { reducedMotion } from '../../../core/motion/motion';

/**
 * Conditions générales d'utilisation. Le sommaire reste visible et suit la lecture
 * (la section en cours est surlignée).
 */
@Component({
  selector: 'app-terms',
  imports: [TranslocoPipe, PageHeaderComponent, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './terms.page.html',
  styleUrl: './terms.page.scss',
})
export class TermsPage {
  protected readonly sections = [
    'objet',
    'comptes',
    'role',
    'reservation',
    'reponse',
    'annulation',
    'remboursement',
    'versement',
    'signalement',
    'sessions',
    'messages',
    'conduite',
    'donnees',
    'contenus',
    'modif',
  ];
  protected readonly current = signal('objet');
  private readonly els = viewChildren<ElementRef<HTMLElement>>('sec');

  constructor() {
    inject(LangService).setTitle('cgu.title');
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries)
            if (e.isIntersecting) this.current.set(e.target.id.replace('cgu-', ''));
        },
        { rootMargin: '-20% 0px -70% 0px' },
      );
      for (const el of this.els()) io.observe(el.nativeElement);
      destroyRef.onDestroy(() => io.disconnect());
    });
  }

  protected go(e: Event, id: string): void {
    e.preventDefault();
    const el = document.getElementById(`cgu-${id}`);
    el?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
    this.current.set(id);
  }
}
