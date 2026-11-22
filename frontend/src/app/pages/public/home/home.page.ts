import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
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
import { GsapKit, loadGsap, reducedMotion } from '../../../core/motion/motion';
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
  imports: [
    RouterLink,
    FormsModule,
    TranslocoPipe,
    RevealDirective,
    CountUpDirective,
    MagneticDirective,
    TiltDirective,
    SplitTextDirective,
    SessionCardComponent,
    RatingStarsComponent,
    ...UI,
  ],
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

  protected readonly subjects = toSignal(this.api.subjects().pipe(catchError(() => of([]))), {
    initialValue: [],
  });
  protected readonly sessions = toSignal(this.api.examSessions().pipe(catchError(() => of([]))), {
    initialValue: [],
  });
  protected readonly stats = toSignal(this.api.stats().pipe(catchError(() => of(null))), {
    initialValue: null,
  });
  protected readonly reviews = toSignal(this.api.latestReviews().pipe(catchError(() => of([]))), {
    initialValue: [],
  });
  protected readonly popular = computed(() => this.subjects().slice(0, 4));
  protected readonly rowA = computed(() => this.subjects().filter((_, i) => i % 2 === 0));
  protected readonly rowB = computed(() => this.subjects().filter((_, i) => i % 2 === 1));
  protected readonly rating = (n: number) => this.num.transform(n, 1);
  protected readonly money = (m: number) => this.dt.transform(Math.round(m / 1000) * 1000);
  protected readonly petals = Array.from({ length: 14 }, (_, i) => i);

  // Simulateur de gains (le tuteur garde 100 % du prix de ses cours particuliers).
  protected readonly hours = signal(4);
  protected readonly price = signal(20);
  protected readonly monthly = computed(
    () => Math.round(this.hours() * 4.33 * this.price()) * 1000,
  );

  // Démo anti-fuite : un numéro de téléphone tapé dans les messages est masqué.
  protected readonly chatStep = signal<ChatStep>(0);
  protected readonly phone = signal(PHONE);
  private timers: ReturnType<typeof setTimeout>[] = [];

  private readonly hero = viewChild.required<ElementRef<HTMLElement>>('hero');
  private readonly scene = viewChild.required<ElementRef<HTMLElement>>('scene');
  // Ces éléments sont dans des blocs @defer : ils apparaissent quand on s'en approche.
  private readonly chat = viewChild<ElementRef<HTMLElement>>('chat');
  private readonly how = viewChild<ElementRef<HTMLElement>>('how');
  private readonly fill = viewChild<ElementRef<HTMLElement>>('fill');
  private readonly zellige = viewChild<ElementRef<HTMLElement>>('zellige');
  /** GSAP, chargé au premier défilement. */
  private readonly gsap = signal<GsapKit | null>(null);

  constructor() {
    inject(LangService).setTitle('home.title');
    this.destroyRef.onDestroy(() => this.timers.forEach(clearTimeout));
    afterNextRender(() => {
      this.parallax();
      // Les effets liés au défilement ne servent qu'une fois qu'on défile : GSAP est chargé
      // au premier geste (molette, toucher, clavier), jamais pendant le premier affichage.
      if (reducedMotion()) return;
      const events = ['wheel', 'touchstart', 'keydown', 'scroll'] as const;
      const start = () => {
        events.forEach((t) => removeEventListener(t, start));
        void loadGsap().then((kit) => this.gsap.set(kit));
      };
      events.forEach((t) => addEventListener(t, start, { once: true, passive: true }));
      this.destroyRef.onDestroy(() => events.forEach((t) => removeEventListener(t, start)));
    });

    // La démo de messagerie se joue quand elle arrive à l'écran.
    effect((onCleanup) => {
      const el = this.chat()?.nativeElement;
      if (!el) return;
      if (reducedMotion() || typeof IntersectionObserver === 'undefined') {
        this.chatStep.set(4);
        this.phone.set('•••');
        return;
      }
      const io = new IntersectionObserver(
        ([e]) => {
          if (!e.isIntersecting) return;
          io.disconnect();
          this.playChat();
        },
        { threshold: 0.5 },
      );
      io.observe(el);
      onCleanup(() => io.disconnect());
    });

    // La porte s'approche quand on quitte le héros.
    effect((onCleanup) => {
      const kit = this.gsap();
      if (!kit) return;
      const tween = kit.gsap.to(this.scene().nativeElement, {
        yPercent: 10,
        scale: 1.06,
        ease: 'none',
        scrollTrigger: {
          trigger: this.hero().nativeElement,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.4,
        },
      });
      onCleanup(() => (tween.scrollTrigger?.kill(), tween.kill()));
    });

    // Le rail des trois étapes se remplit au défilement ; chaque pastille s'allume à son passage.
    effect((onCleanup) => {
      const kit = this.gsap();
      const box = this.how()?.nativeElement;
      const fill = this.fill()?.nativeElement;
      if (!kit || !box || !fill) return;
      const steps = [...box.querySelectorAll<HTMLElement>('.step')];
      const tween = kit.gsap.fromTo(
        fill,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: box,
            start: 'top 80%',
            end: 'bottom 60%',
            scrub: 0.5,
            onUpdate: (st) =>
              steps.forEach((el, i) =>
                el.classList.toggle('lit', st.progress >= i / (steps.length - 1) - 0.02),
              ),
          },
        },
      );
      kit.ScrollTrigger.refresh();
      onCleanup(() => (tween.scrollTrigger?.kill(), tween.kill()));
    });

    // Le zellige du bandeau des chiffres tourne lentement avec le défilement.
    effect((onCleanup) => {
      const kit = this.gsap();
      const z = this.zellige()?.nativeElement;
      if (!kit || !z) return;
      const tween = kit.gsap.to(z, {
        rotate: 60,
        ease: 'none',
        scrollTrigger: {
          trigger: z.parentElement,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });
      kit.ScrollTrigger.refresh();
      onCleanup(() => (tween.scrollTrigger?.kill(), tween.kill()));
    });
  }

  protected go(): void {
    void this.router.navigate(['/recherche'], {
      queryParams: this.subject ? { matiere: this.subject } : {},
    });
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
    this.destroyRef.onDestroy(
      () => (hero.removeEventListener('pointermove', move), cancelAnimationFrame(frame)),
    );
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
      at(3300 + i * 55, () =>
        this.phone.set(
          PHONE.replace(/\d/g, () => glyphs[Math.floor(Math.random() * glyphs.length)]),
        ),
      );
    }
    at(3900, () => {
      this.phone.set('•••');
      this.chatStep.set(4);
    });
  }
}
