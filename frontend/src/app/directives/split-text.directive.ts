import { DestroyRef, Directive, ElementRef, effect, inject, input } from '@angular/core';
import { loadGsap, reducedMotion } from '../core/motion/motion';

/**
 * Titre animé lettre par lettre quand il arrive à l'écran (GSAP SplitText + ScrollTrigger).
 * Le texte est passé en entrée (`[appSplit]="'cle' | transloco"`) et posé par la directive :
 * au changement de langue, l'ancien découpage est annulé puis refait sur le nouveau texte.
 * En arabe, on découpe par mots : couper un mot arabe en lettres casserait les ligatures.
 * Lecteurs d'écran : SplitText garde le texte entier en aria-label.
 */
@Directive({ selector: '[appSplit]' })
export class SplitTextDirective {
  readonly text = input.required<string>({ alias: 'appSplit' });
  private readonly el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private cleanup: (() => void) | null = null;
  private token = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cleanup?.());
    effect(() => {
      const text = this.text();
      this.cleanup?.();
      this.cleanup = null;
      this.el.textContent = text;
      if (!reducedMotion()) void this.animate(++this.token);
    });
  }

  private async animate(token: number): Promise<void> {
    const { gsap, SplitText } = await loadGsap();
    if (token !== this.token || !this.el.isConnected) return;
    const byWord = document.documentElement.lang === 'ar';
    const split = SplitText.create(this.el, { type: byWord ? 'words' : 'words,chars', mask: 'words' });
    const tween = gsap.from(byWord ? split.words : split.chars, {
      yPercent: 115,
      rotate: byWord ? 0 : 6,
      opacity: 0,
      duration: 0.75,
      ease: 'power3.out',
      stagger: byWord ? 0.07 : 0.016,
      scrollTrigger: { trigger: this.el, start: 'top 90%', once: true },
    });
    this.cleanup = () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      split.revert();
    };
  }
}
