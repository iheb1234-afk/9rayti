import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, linkedSignal, signal, untracked, viewChild, viewChildren } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { UI } from '../../../components';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { TabItem, TabsComponent } from '../../../components/tabs/tabs.component';
import { LangService } from '../../../core/i18n/lang.service';
import { loadGsap, reducedMotion } from '../../../core/motion/motion';
import { RevealDirective } from '../../../directives/reveal.directive';
import { SplitTextDirective } from '../../../directives/split-text.directive';

type Who = 'etudiant' | 'tuteur';
interface Step {
  key: string;
  icon: string;
}
const JOURNEYS: Record<Who, Step[]> = {
  etudiant: [
    { key: 'search', icon: 'search' },
    { key: 'request', icon: 'send' },
    { key: 'wait', icon: 'hourglass' },
    { key: 'live', icon: 'video' },
    { key: 'replay', icon: 'play' },
    { key: 'review', icon: 'star' },
  ],
  tuteur: [
    { key: 'signup', icon: 'badge-check' },
    { key: 'agenda', icon: 'calendar' },
    { key: 'accept', icon: 'circle-check' },
    { key: 'teach', icon: 'video' },
    { key: 'paid', icon: 'wallet' },
  ],
};

/**
 * « Comment ça marche » : le parcours de l'étudiant ou du tuteur, étape par étape.
 * Le téléphone reste fixe pendant le défilement et change d'écran à chaque étape
 * (IntersectionObserver) ; la barre de progression suit le défilement (GSAP ScrollTrigger).
 */
@Component({
  selector: 'app-how-it-works',
  imports: [RouterLink, TranslocoPipe, PageHeaderComponent, TabsComponent, RevealDirective, SplitTextDirective, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './how-it-works.page.html',
  styleUrl: './how-it-works.page.scss',
})
export class HowItWorksPage {
  /** ?pour=tuteur ouvre directement le parcours du tuteur. */
  readonly pour = input<string>();
  private readonly i18n = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly who = linkedSignal<string>(() => (this.pour() === 'tuteur' ? 'tuteur' : 'etudiant'));
  protected readonly steps = computed(() => JOURNEYS[this.who() as Who]);
  protected readonly active = signal(0);
  protected readonly tabs = computed<TabItem[]>(() => [
    { id: 'etudiant', label: this.i18n.translate('how.forStudent') },
    { id: 'tuteur', label: this.i18n.translate('how.forTutor') },
  ]);
  protected readonly faq = ['money', 'absent', 'contact', 'verify', 'price', 'lang'];
  private readonly items = viewChildren<ElementRef<HTMLElement>>('step');
  private readonly rail = viewChild<ElementRef<HTMLElement>>('rail');
  private io?: IntersectionObserver;

  constructor() {
    inject(LangService).setTitle('how.title');
    // L'étape active est celle qui traverse le milieu de l'écran.
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      this.io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) if (e.isIntersecting) this.active.set(Number((e.target as HTMLElement).dataset['i']));
        },
        { rootMargin: '-45% 0px -45% 0px' },
      );
      this.destroyRef.onDestroy(() => this.io?.disconnect());
      this.observe();
      if (!reducedMotion()) void this.progress();
    });
    // Nouveau parcours : on observe les nouvelles étapes.
    effect(() => {
      this.items();
      untracked(() => {
        this.active.set(0);
        this.observe();
      });
    });
  }

  private observe(): void {
    if (!this.io) return;
    this.io.disconnect();
    for (const el of this.items()) this.io.observe(el.nativeElement);
  }

  /** Barre verticale qui se remplit au fil du défilement. */
  private async progress(): Promise<void> {
    const { gsap } = await loadGsap();
    const rail = this.rail()?.nativeElement;
    if (!rail) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        rail.querySelector('.fill'),
        { scaleY: 0 },
        { scaleY: 1, ease: 'none', scrollTrigger: { trigger: rail.parentElement, start: 'top 55%', end: 'bottom 55%', scrub: 0.3 } },
      );
    });
    this.destroyRef.onDestroy(() => ctx.revert());
  }

  protected go(i: number): void {
    this.items()[i]?.nativeElement.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
  }
}
