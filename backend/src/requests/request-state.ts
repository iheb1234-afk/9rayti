/**
 * Les états d'une demande de cours, tels que fixés à l'objectif 2.
 *
 *   en_attente ──accepter──▶ acceptee ──cours fait──▶ faite ──24 h sans signalement──▶ versee
 *       │                       │                       └──signaler──▶ signalee ──admin──▶ versee
 *       │                       │                                         └──admin──▶ remboursee
 *       ├─ refuser ─▶ refusee   └─ le tuteur annule ─▶ annulee_tuteur
 *       ├─ 12 h sans réponse ─▶ expiree
 *       └─ l'étudiant annule ─▶ annulee
 *
 * Fonctions pures, sans base de données : faciles à tester (request-state.spec.ts).
 */
export type RequestState =
  | 'en_attente'
  | 'acceptee'
  | 'faite'
  | 'versee'
  | 'signalee'
  | 'remboursee'
  | 'refusee'
  | 'expiree'
  | 'annulee'
  | 'annulee_tuteur';

export type RequestAction =
  'accepter' | 'refuser' | 'expirer' | 'annuler' | 'annuler_tuteur' | 'terminer' | 'signaler' | 'verser' | 'rembourser';

const TRANSITIONS: Record<RequestAction, { from: RequestState[]; to: RequestState }> = {
  accepter: { from: ['en_attente'], to: 'acceptee' },
  refuser: { from: ['en_attente'], to: 'refusee' },
  expirer: { from: ['en_attente'], to: 'expiree' },
  annuler: { from: ['en_attente'], to: 'annulee' },
  annuler_tuteur: { from: ['acceptee'], to: 'annulee_tuteur' },
  terminer: { from: ['acceptee'], to: 'faite' },
  signaler: { from: ['faite'], to: 'signalee' },
  // Versement automatique 24 h après le cours, ou décision de l'admin sur un signalement.
  verser: { from: ['faite', 'signalee'], to: 'versee' },
  // L'admin donne raison à l'étudiant qui a signalé un problème.
  rembourser: { from: ['signalee'], to: 'remboursee' },
};

/** États qui rendent l'argent à l'étudiant, en crédits 9rayti. */
export const REFUND_STATES: ReadonlySet<RequestState> = new Set([
  'refusee',
  'expiree',
  'annulee',
  'annulee_tuteur',
  'remboursee',
]);

/** États où le cours a lieu ou a eu lieu : la salle de cours est ouverte aux deux participants. */
export const CLASSROOM_STATES: ReadonlySet<RequestState> = new Set([
  'acceptee',
  'faite',
  'versee',
  'signalee',
  'remboursee',
]);

export class TransitionError extends Error {
  constructor(
    readonly action: RequestAction,
    readonly from: RequestState,
  ) {
    super(`Action « ${action} » impossible depuis l'état « ${from} »`);
  }
}

export function canApply(action: RequestAction, from: RequestState): boolean {
  return TRANSITIONS[action].from.includes(from);
}

export function nextState(action: RequestAction, from: RequestState): RequestState {
  if (!canApply(action, from)) throw new TransitionError(action, from);
  return TRANSITIONS[action].to;
}

export function isExpired(state: RequestState, expiresAt: Date, now: Date): boolean {
  return state === 'en_attente' && expiresAt.getTime() <= now.getTime();
}

export function isPayoutDue(state: RequestState, payoutAt: Date | null, now: Date): boolean {
  return state === 'faite' && payoutAt !== null && payoutAt.getTime() <= now.getTime();
}

/** Taux de réponse affiché sur la carte du tuteur ; null tant qu'il n'a reçu aucune demande. */
export function responseRate(received: number, answered: number): number | null {
  if (received === 0) return null;
  return Math.round((answered / received) * 100);
}

/** La note moyenne n'est affichée qu'à partir de 5 avis, comme décidé (sinon « Nouveau »). */
export function publicRating(sum: number, count: number): number | null {
  if (count < 5) return null;
  return Math.round((sum / count) * 10) / 10;
}
