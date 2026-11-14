/**
 * Les montants sont stockés en millimes (1 DT = 1 000 millimes) :
 * des entiers, donc aucune erreur d'arrondi sur l'argent.
 */
export const BOOKING_FEE_MILLIMES = 3_000;

/** Délai laissé au tuteur pour répondre à une demande. */
export const RESPONSE_DELAY_MS = 12 * 60 * 60 * 1000;

/** Délai pendant lequel l'étudiant peut signaler un problème avant le versement au tuteur. */
export const REPORT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function lessonPrice(pricePerHourMillimes: number, durationMin: number): number {
  return Math.round((pricePerHourMillimes * durationMin) / 60);
}

export function formatDt(millimes: number): string {
  return `${(millimes / 1000).toFixed(1).replace('.', ',')} DT`;
}
