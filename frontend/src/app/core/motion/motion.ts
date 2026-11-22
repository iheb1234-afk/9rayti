/**
 * Outils d'animation. GSAP et les confettis ne sont chargés qu'à la demande (import dynamique) :
 * ils ne pèsent rien sur le premier affichage. Tout respecte prefers-reduced-motion.
 */
export function reducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface GsapKit {
  gsap: typeof import('gsap').gsap;
  ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger;
  SplitText: typeof import('gsap/SplitText').SplitText;
}

let gsapKit: Promise<GsapKit> | null = null;

/** GSAP + ScrollTrigger (animations liées au défilement) + SplitText (texte lettre par lettre). */
export function loadGsap(): Promise<GsapKit> {
  gsapKit ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('gsap/SplitText')]).then(([g, st, sp]) => {
    g.gsap.registerPlugin(st.ScrollTrigger, sp.SplitText);
    return { gsap: g.gsap, ScrollTrigger: st.ScrollTrigger, SplitText: sp.SplitText };
  });
  return gsapKit;
}

const BRAND = ['#0D4F9C', '#E9B23A', '#5B6B2E', '#ECE4D2', '#A8382B', '#E3ECF7'];

/** Pluie de confettis aux couleurs de la charte (réservation envoyée, cours accepté…). */
export async function celebrate(origin?: { x: number; y: number }): Promise<void> {
  if (reducedMotion()) return;
  const confetti = (await import('canvas-confetti')).default;
  const o = origin ?? { x: 0.5, y: 0.6 };
  confetti({ particleCount: 90, spread: 70, startVelocity: 38, origin: o, colors: BRAND, scalar: 0.9, disableForReducedMotion: true });
  setTimeout(() => confetti({ particleCount: 50, spread: 110, startVelocity: 25, origin: o, colors: BRAND, shapes: ['circle'], disableForReducedMotion: true }), 180);
}

/** Origine (0 → 1) d'un événement souris, pour faire partir les confettis du bouton cliqué. */
export function originOf(event?: Event): { x: number; y: number } | undefined {
  const t = event?.target as HTMLElement | undefined;
  if (!t?.getBoundingClientRect) return undefined;
  const r = t.getBoundingClientRect();
  return { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight };
}
