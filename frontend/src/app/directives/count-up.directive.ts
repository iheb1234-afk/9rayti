import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { reducedMotion } from '../core/motion/motion';

/**
 * Compteur animé : le nombre monte de 0 à sa valeur quand il devient visible
 * (ou de l'ancienne à la nouvelle valeur quand elle change, ex. un solde de crédits).
 */
@Directive({ selector: '[appCountUp]' })
export class CountUpDirective {
  readonly value = input.required<number | null>({ alias: 'appCountUp' });
  /** Mise en forme du nombre affiché (ex. montant en dinars). */
  readonly format = input<(n: number) => string>((n) => Math.round(n).toLocaleString());
  readonly duration = input(1400);
  private readonly el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private readonly visible = signal(false);
  private current = 0;
  private frame = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => cancelAnimationFrame(this.frame));
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return this.visible.set(true);
      const io = new IntersectionObserver(
        ([e]) => e.isIntersecting && (this.visible.set(true), io.disconnect()),
        { threshold: 0.3 },
      );
      io.observe(this.el);
      destroyRef.onDestroy(() => io.disconnect());
    });
    effect(() => {
      const target = this.value();
      if (target === null) {
        this.el.textContent = '—';
        return;
      }
      if (!this.visible()) {
        this.el.textContent = this.format()(this.current);
        return;
      }
      this.animate(this.current, target);
    });
  }

  private animate(from: number, to: number): void {
    cancelAnimationFrame(this.frame);
    if (reducedMotion() || from === to) {
      this.current = to;
      this.el.textContent = this.format()(to);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / this.duration(), 1);
      const eased = 1 - Math.pow(1 - p, 4); // ralentit à l'arrivée
      this.current = from + (to - from) * eased;
      this.el.textContent = this.format()(this.current);
      if (p < 1) this.frame = requestAnimationFrame(step);
      else this.current = to;
    };
    this.frame = requestAnimationFrame(step);
  }
}
