import { MASK, maskContactInfo } from './contact-masking';

describe('Masquage des coordonnées dans les messages (règle anti-fuite)', () => {
  it('laisse passer un message normal', () => {
    const r = maskContactInfo('Bonjour, on peut revoir le chapitre 4 sur les lois continues ?');
    expect(r).toEqual({ text: 'Bonjour, on peut revoir le chapitre 4 sur les lois continues ?', masked: false });
  });

  it.each([
    ['appelle-moi au 22 345 678', '22 345 678'],
    ['mon num +216 98.765.432 stp', '+216 98.765.432'],
    ['0021655123456', '0021655123456'],
    ['رقمي ٢٢٣٤٥٦٧٨', '٢٢٣٤٥٦٧٨'],
  ])('masque un numéro de téléphone : « %s »', (input, secret) => {
    const r = maskContactInfo(input);
    expect(r.masked).toBe(true);
    expect(r.text).toContain(MASK);
    expect(r.text).not.toContain(secret);
    expect(r.text).not.toMatch(/\d{6}|[\u0660-\u0669]{6}/);
  });

  it.each([
    'écris-moi sur sarra.b@gmail.com',
    'sarra [at] gmail [dot] com',
    'ajoute-moi sur insta @sarra.maths',
    'on continue sur WhatsApp',
    'nzidek 3al wtsp',
    'كلمني على الواتساب',
    'voici le lien https://wa.me/21622345678',
    'facebook.com/sarra.b',
  ])('masque une coordonnée ou une messagerie : « %s »', (input) => {
    const r = maskContactInfo(input);
    expect(r.masked).toBe(true);
    expect(r.text).toContain(MASK);
  });

  it('ne confond pas les mots du cours avec une messagerie', () => {
    expect(maskContactInfo('Traitement du signal et proba wa stat').masked).toBe(false);
  });

  it('ne touche pas aux nombres courts (heures, chapitres, notes)', () => {
    expect(maskContactInfo('cours à 18h30, chapitre 12, j’ai eu 14/20').masked).toBe(false);
  });
});
