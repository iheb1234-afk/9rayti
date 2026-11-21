import {
  CLASSROOM_STATES,
  REFUND_STATES,
  RequestAction,
  RequestState,
  TransitionError,
  canApply,
  isExpired,
  isPayoutDue,
  nextState,
  publicRating,
  responseRate,
} from './request-state';

describe('Machine à états d’une demande de cours', () => {
  it('suit le parcours normal : en attente → acceptée → faite → versée', () => {
    let s: RequestState = 'en_attente';
    s = nextState('accepter', s);
    expect(s).toBe('acceptee');
    s = nextState('terminer', s);
    expect(s).toBe('faite');
    s = nextState('verser', s);
    expect(s).toBe('versee');
  });

  it.each<[RequestAction, RequestState]>([
    ['refuser', 'refusee'],
    ['expirer', 'expiree'],
    ['annuler', 'annulee'],
  ])('« %s » depuis en_attente mène à %s', (action, to) => {
    expect(nextState(action, 'en_attente')).toBe(to);
  });

  it('une fois acceptée, l’étudiant ne peut plus annuler (règle « once the tutor accepts it’s over »)', () => {
    expect(canApply('annuler', 'acceptee')).toBe(false);
    expect(() => nextState('annuler', 'acceptee')).toThrow(TransitionError);
  });

  it('le tuteur peut encore annuler une demande acceptée (remboursement intégral)', () => {
    expect(nextState('annuler_tuteur', 'acceptee')).toBe('annulee_tuteur');
    expect(REFUND_STATES.has('annulee_tuteur')).toBe(true);
  });

  it('un signalement n’est possible qu’après le cours', () => {
    expect(canApply('signaler', 'acceptee')).toBe(false);
    expect(nextState('signaler', 'faite')).toBe('signalee');
  });

  it('un signalement est tranché par l’admin : rembourser l’étudiant ou payer le tuteur', () => {
    expect(nextState('rembourser', 'signalee')).toBe('remboursee');
    expect(nextState('verser', 'signalee')).toBe('versee');
    expect(canApply('rembourser', 'faite')).toBe(false);
    expect(REFUND_STATES.has('remboursee')).toBe(true);
  });

  it('les états finaux n’acceptent plus aucune action', () => {
    const finals: RequestState[] = ['versee', 'remboursee', 'refusee', 'expiree', 'annulee', 'annulee_tuteur'];
    const actions: RequestAction[] = [
      'accepter',
      'refuser',
      'expirer',
      'annuler',
      'annuler_tuteur',
      'terminer',
      'signaler',
      'verser',
      'rembourser',
    ];
    for (const s of finals) for (const a of actions) expect(canApply(a, s)).toBe(false);
  });

  it('le message d’erreur nomme l’action et l’état', () => {
    expect(() => nextState('verser', 'en_attente')).toThrow(
      "Action « verser » impossible depuis l'état « en_attente »",
    );
  });

  it('chaque état remboursé rend l’argent en crédits ; seule une salle tranchée par l’admin reste ouverte', () => {
    for (const s of CLASSROOM_STATES) if (s !== 'remboursee') expect(REFUND_STATES.has(s)).toBe(false);
    expect([...REFUND_STATES].sort()).toEqual(['annulee', 'annulee_tuteur', 'expiree', 'refusee', 'remboursee']);
  });
});

describe('Délais', () => {
  const now = new Date('2026-11-14T20:00:00Z');
  it('une demande expire 12 h sans réponse, pas avant', () => {
    expect(isExpired('en_attente', new Date('2026-11-14T19:59:59Z'), now)).toBe(true);
    expect(isExpired('en_attente', new Date('2026-11-14T20:00:01Z'), now)).toBe(false);
    expect(isExpired('acceptee', new Date('2026-11-14T10:00:00Z'), now)).toBe(false);
  });
  it('le tuteur est payé 24 h après le cours, si personne n’a signalé', () => {
    expect(isPayoutDue('faite', new Date('2026-11-14T19:00:00Z'), now)).toBe(true);
    expect(isPayoutDue('signalee', new Date('2026-11-14T19:00:00Z'), now)).toBe(false);
    expect(isPayoutDue('faite', null, now)).toBe(false);
  });
});

describe('Indicateurs publics du tuteur', () => {
  it('taux de réponse arrondi, inconnu tant qu’aucune demande', () => {
    expect(responseRate(0, 0)).toBeNull();
    expect(responseRate(25, 24)).toBe(96);
    expect(responseRate(3, 1)).toBe(33);
  });
  it('la note n’est affichée qu’à partir de 5 avis (sinon « Nouveau »)', () => {
    expect(publicRating(19, 4)).toBeNull();
    expect(publicRating(24, 5)).toBe(4.8);
    expect(publicRating(59, 12)).toBe(4.9);
  });
});
