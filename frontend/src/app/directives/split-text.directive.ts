import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
} from '@angular/core';
import { loadGsap, reducedMotion } from '../core/motion/motion';

/**
 * Titre animé lettre par lettre quand il arrive à l'écran (GSAP SplitText + ScrollTrigger).
 * Le texte est passé en entrée (`[appSplit]="'cle' | transloco"`) et posé par la directive :
 * au changement de langue, l'ancien découpage est annulé puis refait sur le nouveau texte.
 *
 * Performance : GSAP n'est chargé que lorsqu'un titre approche de l'écran. Un titre déjà visible
 * au chargement reste simplement affiché (aucun script lourd pendant le premier affichage).
 * En arabe, on découpe par mots : couper un mot arabe en lettres casserait les ligatures.
 * Lecteurs d'écran : SplitText garde le texte entier en aria-label.
 */
@Directive({ selector: '[appSplit]' })
export class SplitTextDirective {
  readonly text = input.required<string>({ alias: 'appSplit' });
  private readonly el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private cleanup: (() => void) | null = null;
  private token = 0;
  /** Le titre était hors de l'écran au chargement : il sera animé à son arrivée. */
  private armed = false;
  private played = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.cleanup?.());
    effect(() => {
      const text = this.text();
      this.cleanup?.();
      this.cleanup = null;
      this.el.textContent = text;
      // Changement de langue après l'animation : le nouveau texte s'affiche directement.
    });
    afterNextRender(() => {
      if (reducedMotion() || typeof IntersectionObserver === 'undefined') return;
      let first = true;
      const io = new IntersectionObserver(
        ([e]) => {
          if (first) {
            first = false;
            // Visible dès le chargement : on n'anime pas (pas de clignotement, pas de GSAP).
            if (e.isIntersecting) return io.disconnect();
            this.armed = true;
            return;
          }
          if (!e.isIntersecting || !this.armed || this.played) return;
          this.played = true;
          io.disconnect();
          void this.animate(++this.token);
        },
        // Déclenché un peu avant l'arrivée à l'écran, le temps de charger GSAP.
        { rootMargin: '0px 0px 20% 0px' },
      );
      io.observe(this.el);
      destroyRef.onDestroy(() => io.disconnect());
    });
  }

  private async animate(token: number): Promise<void> {
    this.el.classList.add('split-pending');
    // Si GSAP tarde (réseau lent), le titre réapparaît quand même.
    const safety = setTimeout(() => this.el.classList.remove('split-pending'), 1500);
    try {
      const { gsap, SplitText } = await loadGsap();
      if (token !== this.token || !this.el.isConnected) return;
      const byWord = document.documentElement.lang === 'ar';
      const split = SplitText.create(this.el, {
        type: byWord ? 'words' : 'words,chars',
        mask: 'words',
      });
      this.el.classList.remove('split-pending');
      const tween = gsap.from(byWord ? split.words : split.chars, {
        yPercent: 115,
        rotate: byWord ? 0 : 6,
        opacity: 0,
        duration: 0.75,
        ease: 'power3.out',
        stagger: byWord ? 0.07 : 0.016,
        scrollTrigger: { trigger: this.el, start: 'top 92%', once: true },
        onComplete: () => split.revert(),
      });
      this.cleanup = () => {
        tween.scrollTrigger?.kill();
        tween.kill();
        split.revert();
      };
    } finally {
      clearTimeout(safety);
      this.el.classList.remove('split-pending');
    }
  }
}
