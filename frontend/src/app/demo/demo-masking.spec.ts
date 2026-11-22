import { maskContactInfo } from './demo-masking';

/** Même règle que l'API (backend/src/messages/contact-masking.spec.ts) : la démo doit se comporter pareil. */
describe('maskContactInfo (mode démo)', () => {
  it('masque un numéro tunisien, même avec des espaces ou des points', () => {
    expect(maskContactInfo('Appelle-moi au 22 345 678').text).toBe('Appelle-moi au •••');
    expect(maskContactInfo('+216 22.345.678').masked).toBeTrue();
  });

  it('masque les chiffres arabes', () => {
    const r = maskContactInfo('رقمي ٢٢٣٤٥٦٧٨');
    expect(r.masked).toBeTrue();
    expect(r.text).not.toMatch(/\d{8}/);
  });

  it('masque e-mails, liens et messageries', () => {
    expect(maskContactInfo('écris à sarra@gmail.com').text).toBe('écris à •••');
    expect(maskContactInfo('mon insta : instagram.com/sarra').masked).toBeTrue();
    expect(maskContactInfo('on continue sur WhatsApp ?').text).toBe('on continue sur ••• ?');
  });

  it('laisse passer un message normal', () => {
    const r = maskContactInfo('Le DS est le 12/01, chapitre 4 et exercice 3.');
    expect(r.masked).toBeFalse();
    expect(r.text).toBe('Le DS est le 12/01, chapitre 4 et exercice 3.');
  });
});
