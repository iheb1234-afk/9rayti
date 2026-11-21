/**
 * Classement « pertinence » des tuteurs.
 *
 * Inspiré du score pondéré de discuno (voir docs/recherche-projets-similaires.md), mais
 * calculable à la volée : moyenne bayésienne des notes (un 5/5 sur un seul avis ne passe pas
 * devant un 4,8 sur trente), réactivité (décision n° 10 de l'Objectif 2 : un tuteur qui
 * refuse ou laisse expirer descend) et expérience (heures données, avec un effet qui s'atténue).
 */
export const PRIOR_MEAN = 4.2;
export const PRIOR_WEIGHT = 5;

export function bayesianRating(
  ratingSum: number,
  ratingCount: number,
  prior = PRIOR_MEAN,
  weight = PRIOR_WEIGHT,
): number {
  return (prior * weight + ratingSum) / (weight + ratingCount);
}

export interface RankingInput {
  ratingSum: number;
  ratingCount: number;
  /** Taux de réponse en %, ou null si le tuteur n'a encore reçu aucune demande. */
  responseRate: number | null;
  hoursTaught: number;
}

export function relevanceScore(t: RankingInput): number {
  const rating = bayesianRating(t.ratingSum, t.ratingCount); // entre 1 et 5
  const responsiveness = (t.responseRate ?? 100) / 100; // entre 0 et 1
  const experience = Math.min(Math.log10(1 + t.hoursTaught) / 2, 1); // 0 → 1 vers 100 h
  return rating + 1.5 * responsiveness + 0.5 * experience;
}
