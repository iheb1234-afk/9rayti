import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';
import { reducedMotion } from '../core/motion/motion';

/**
 * Fait apparaître l'élément quand il entre à l'écran (fondu + glissement, voir styles.scss).
 * `appReveal="120ms"` décale l'apparition, pour un effet en cascade dans une liste.
 * Idée reprise de Talmidon, sans bibliothèque : IntersectionObserver + transition CSS.
 */
@Directive({
  selector: '[appReveal]',
  host: { class: 'reveal', '[style.--reveal-delay]': 'delay() || "0ms"' },
})
export class RevealDirective {
  readonly delay = input<string>('', { alias: 'appReveal' });

  constructor() {
    const el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (reducedMotion() || typeof IntersectionObserver === 'undefined') {
        el.classList.add('is-visible');
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
      );
      io.observe(el);
      destroyRef.onDestroy(() => io.disconnect());
    });
  }
}
