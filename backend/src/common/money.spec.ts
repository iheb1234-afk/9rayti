import { BOOKING_FEE_MILLIMES, formatDt, lessonPrice } from './money';

describe('Argent (millimes entiers, 1 DT = 1000)', () => {
  it('prix d’un cours au prorata de la durée', () => {
    expect(lessonPrice(20_000, 60)).toBe(20_000);
    expect(lessonPrice(20_000, 90)).toBe(30_000);
    expect(lessonPrice(25_000, 45)).toBe(18_750);
  });
  it('frais de réservation fixes de 3 DT', () => {
    expect(BOOKING_FEE_MILLIMES).toBe(3_000);
  });
  it('affichage à la tunisienne', () => {
    expect(formatDt(23_000)).toBe('23,0 DT');
    expect(formatDt(18_750)).toBe('18,8 DT');
  });
});
