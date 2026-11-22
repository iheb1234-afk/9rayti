import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { catchError, of } from 'rxjs';
import { UI } from '../../../components';
import { RatingStarsComponent } from '../../../components/rating-stars/rating-stars.component';
import { SessionCardComponent } from '../../../components/session-card/session-card.component';
import { ApiService } from '../../../core/api/api.service';
import { LangService } from '../../../core/i18n/lang.service';
import { loadGsap, reducedMotion } from '../../../core/motion/motion';
import { CountUpDirective } from '../../../directives/count-up.directive';
import { MagneticDirective } from '../../../directives/magnetic.directive';
import { RevealDirective } from '../../../directives/reveal.directive';
import { SplitTextDirective } from '../../../directives/split-text.directive';
import { TiltDirective } from '../../../directives/tilt.directive';
import { DtPipe } from '../../../pipes/dt.pipe';
import { NumPipe } from '../../../pipes/num.pipe';

/** Étapes de la démo « coordonnées masquées » (question, frappe, numéro, masquage). */
type ChatStep = 0 | 1 | 2 | 3 | 4;
const PHONE = '22 345 678';

/**
 * Accueil : la porte bleue de Sidi Bou Saïd s'ouvre sur la plateforme.
 * Le premier écran n'utilise que du CSS (affichage immédiat, bon LCP) ; GSAP n'est chargé
 * qu'ensuite, pendant un temps mort du navigateur, pour les effets liés au défilement.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink, FormsModule, TranslocoPipe, RevealDirective, CountUpDirective, MagneticDirective, TiltDirective, SplitTextDirective, SessionCardComponent, RatingStarsComponent, ...UI],
  providers: [NumPipe, DtPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage {
  protected readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly num = inject(NumPipe);
  private readonly dt = inject(DtPipe);
  private readonly destroyRef = inject(DestroyRef);
  protected subject = '';

  protected readonly subjects = toSignal(this.api.subjects().pipe(catchError(() => of([]))), { initialValue: [] });
  protected readonly sessions = toSignal(this.api.examSessions().pipe(catchError(() => of([]))), { initialValue: [] });
  protected readonly stats = toSignal(this.api.stats().pipe(catchError(() => of(null))), { initialValue: null });
  protected readonly reviews = toSignal(this.api.latestReviews().pipe(catchError(() => of([]))), { initialValue: [] });
  protected readonly popular = computed(() => this.subjects().slice(0, 4));
  protected readonly rowA = computed(() => this.subjects().filter((_, i) => i % 2 === 0));
  protected readonly rowB = computed(() => this.subjects().filter((_, i) => i % 2 === 1));
  protected readonly rating = (n: number) => this.num.transform(n, 1);
  protected readonly money = (m: number) => this.dt.transform(Math.round(m / 1000) * 1000);
  protected readonly petals = Array.from({ length: 14 }, (_, i) => i);

  // Simulateur de gains (le tuteur garde 100 % du prix de ses cours particuliers).
  protected readonly hours = signal(4);
  protected readonly price = signal(20);
  protected readonly monthly = computed(() => Math.round(this.hours() * 4.33 * this.price()) * 1000);

  // Démo anti-fuite : un numéro de téléphone tapé dans les messages est masqué.
  protected readonly chatStep = signal<ChatStep>(0);
  protected readonly phone = signal(PHONE);
  private timers: ReturnType<typeof setTimeout>[] = [];

  private readonly hero = viewChild.required<ElementRef<HTMLElement>>('hero');
  private readonly scene = viewChild.required<ElementRef<HTMLElement>>('scene');
  private readonly chat = viewChild.required<ElementRef<HTMLElement>>('chat');
  private readonly path = viewChild<ElementRef<SVGPathElement>>('path');
  private readonly zellige = viewChild<ElementRef<HTMLElement>>('zellige');

  constructor() {
    inject(LangService).setTitle('home.title');
    this.destroyRef.onDestroy(() => this.timers.forEach(clearTimeout));
    afterNextRender(() => {
      this.parallax();
      this.watchChat();
      const idle = (cb: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 2500 }) : setTimeout(cb, 1200));
      if (!reducedMotion()) idle(() => void this.scrollEffects());
    });
  }

  protected go(): void {
    void this.router.navigate(['/recherche'], { queryParams: this.subject ? { matiere: this.subject } : {} });
  }

  /** Les cartes flottantes suivent légèrement la souris (profondeurs différentes). */
  private parallax(): void {
    if (reducedMotion() || !matchMedia('(pointer: fine)').matches) return;
    const hero = this.hero().nativeElement;
    const scene = this.scene().nativeElement;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        scene.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        scene.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
    };
    hero.addEventListener('pointermove', move, { passive: true });
    this.destroyRef.onDestroy(() => (hero.removeEventListener('pointermove', move), cancelAnimationFrame(frame)));
  }

  /** La démo de messagerie se joue quand elle arrive à l'écran. */
  private watchChat(): void {
    if (reducedMotion() || typeof IntersectionObserver === 'undefined') {
      this.chatStep.set(4);
      this.phone.set('•••');
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      this.playChat();
    }, { threshold: 0.5 });
    io.observe(this.chat().nativeElement);
    this.destroyRef.onDestroy(() => io.disconnect());
  }

  protected playChat(): void {
    this.timers.forEach(clearTimeout);
    this.chatStep.set(0);
    this.phone.set(PHONE);
    const at = (ms: number, fn: () => void) => this.timers.push(setTimeout(fn, ms));
    at(250, () => this.chatStep.set(1));
    at(1100, () => this.chatStep.set(2));
    at(2300, () => this.chatStep.set(3));
    // Le numéro « se brouille » avant d'être remplacé : on voit le masquage se produire.
    const glyphs = '0123456789•#*';
    for (let i = 0; i < 10; i++) {
      at(3300 + i * 55, () => this.phone.set(PHONE.replace(/\d/g, () => glyphs[Math.floor(Math.random() * glyphs.length)])));
    }
    at(3900, () => {
      this.phone.set('•••');
      this.chatStep.set(4);
    });
  }

  /** Effets liés au défilement : la porte s'approche, le chemin des étapes se dessine. */
  private async scrollEffects(): Promise<void> {
    const { gsap } = await loadGsap();
    const ctx = gsap.context(() => {
      gsap.to(this.scene().nativeElement, {
        yPercent: 10,
        scale: 1.06,
        ease: 'none',
        scrollTrigger: { trigger: this.hero().nativeElement, start: 'top top', end: 'bottom top', scrub: 0.4 },
      });
      const path = this.path()?.nativeElement;
      if (path) {
        const len = path.getTotalLength();
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(path, {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: { trigger: path.closest('section'), start: 'top 75%', end: 'bottom 70%', scrub: 0.6 },
        });
      }
      const z = this.zellige()?.nativeElement;
      if (z) gsap.to(z, { rotate: 60, ease: 'none', scrollTrigger: { trigger: z.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    this.destroyRef.onDestroy(() => ctx.revert());
  }
}
