import { Directive, ElementRef, inject, input } from '@angular/core';
import { reducedMotion } from '../core/motion/motion';

/**
 * Carte qui s'incline en 3D sous le pointeur, avec un halo lumineux qui suit la souris.
 * Désactivé au toucher et si l'utilisateur préfère moins d'animations.
 */
@Directive({
  selector: '[appTilt]',
  host: {
    class: 'tilt',
    '(pointermove)': 'move($event)',
    '(pointerleave)': 'reset()',
  },
})
export class TiltDirective {
  /** Inclinaison maximale, en degrés. */
  readonly max = input(7, {
    alias: 'appTilt',
    transform: (v: unknown) => (v === '' || v === undefined ? 7 : Number(v)),
  });
  private readonly el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private frame = 0;

  protected move(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || reducedMotion()) return;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const r = this.el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const max = this.max();
      this.el.style.setProperty('--rx', `${(0.5 - py) * max}deg`);
      this.el.style.setProperty('--ry', `${(px - 0.5) * max}deg`);
      this.el.style.setProperty('--mx', `${px * 100}%`);
      this.el.style.setProperty('--my', `${py * 100}%`);
      this.el.classList.add('tilting');
    });
  }

  protected reset(): void {
    cancelAnimationFrame(this.frame);
    this.el.classList.remove('tilting');
    this.el.style.setProperty('--rx', '0deg');
    this.el.style.setProperty('--ry', '0deg');
  }
}
