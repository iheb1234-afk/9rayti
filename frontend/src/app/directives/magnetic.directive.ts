import { Directive, ElementRef, inject } from '@angular/core';
import { reducedMotion } from '../core/motion/motion';

/** Bouton « magnétique » : il se laisse attirer de quelques pixels par le pointeur. */
@Directive({
  selector: '[appMagnetic]',
  host: { class: 'magnetic', '(pointermove)': 'move($event)', '(pointerleave)': 'leave()' },
})
export class MagneticDirective {
  private readonly el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;

  protected move(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || reducedMotion()) return;
    const r = this.el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    this.el.style.transform = `translate(${dx * 0.18}px, ${dy * 0.28}px)`;
  }

  protected leave(): void {
    this.el.style.transform = '';
  }
}
