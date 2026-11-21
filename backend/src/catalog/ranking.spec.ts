import { bayesianRating, relevanceScore } from './ranking';

describe('Classement des tuteurs', () => {
  it('un 5/5 sur un seul avis ne dépasse pas un 4,8 sur trente avis', () => {
    expect(bayesianRating(5, 1)).toBeLessThan(bayesianRating(4.8 * 30, 30));
  });

  it('sans avis, la note retenue est la moyenne de la plateforme', () => {
    expect(bayesianRating(0, 0)).toBeCloseTo(4.2);
  });

  it('à note égale, le tuteur qui répond le plus passe devant', () => {
    const base = { ratingSum: 46, ratingCount: 10, hoursTaught: 20 };
    expect(relevanceScore({ ...base, responseRate: 95 })).toBeGreaterThan(
      relevanceScore({ ...base, responseRate: 50 }),
    );
  });

  it('l’expérience aide, mais sans écraser la qualité', () => {
    const veteran = relevanceScore({ ratingSum: 3.9 * 40, ratingCount: 40, responseRate: 90, hoursTaught: 300 });
    const excellent = relevanceScore({ ratingSum: 4.9 * 40, ratingCount: 40, responseRate: 90, hoursTaught: 20 });
    expect(excellent).toBeGreaterThan(veteran);
  });
});
