/**
 * Règle anti-fuite (Objectif 1) : « la plateforme est la salle de cours ».
 * Avant d'enregistrer un message, on masque tout ce qui permettrait de continuer hors de
 * 9rayti (et donc sans la protection du remboursement) : numéros de téléphone, e-mails,
 * liens, pseudos et noms de messageries. Idée reprise de la modération d'UPchieve.
 *
 * Fonction pure, testée dans contact-masking.spec.ts.
 */
export const MASK = '•••';

/** Chiffres arabo-indiens (٠١٢…) et persans (۰۱۲…) ramenés à 0-9, pour qu'on ne contourne pas la règle. */
function normalizeDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

const RULES: RegExp[] = [
  // Adresses e-mail, y compris « nom [at] gmail [dot] com »
  /[\w.+-]+\s*(?:@|\[at\]|\(at\)|\s+at\s+)\s*[\w-]+\s*(?:\.|\[dot\]|\(dot\)|\s+dot\s+)\s*[a-z]{2,}/gi,
  // Liens
  /\b(?:https?:\/\/|www\.)\S+/gi,
  /\b(?:wa\.me|t\.me|m\.me|fb\.me|bit\.ly|linktr\.ee|instagram\.com|facebook\.com|tiktok\.com|snapchat\.com)\/?\S*/gi,
  // Messageries et réseaux, en français, anglais, arabe et en « arabizi »
  /\b(?:whats?\s?app|watsap+|wtsp|insta(?:gram)?|facebook|fb|messenger|telegram|snap(?:chat)?|viber|tiktok|discord)\b/gi,
  /(?:واتس\s?اب|واتساب|انستقرام|انستغرام|فيسبوك|فايسبوك|ماسنجر|تيليغرام|تلغرام|سناب)/g,
  // Pseudos : @nom
  /(^|[^\w])@[a-z0-9_.]{3,}/gi,
  // Numéros : 8 chiffres ou plus, éventuellement séparés (+216 22 345 678, 22.345.678…)
  /(?:\+|00)?\d(?:[\s.\-/]*\d){7,}/g,
];

export interface MaskResult {
  text: string;
  masked: boolean;
}

export function maskContactInfo(input: string): MaskResult {
  let text = normalizeDigits(input);
  for (const rule of RULES) {
    text = text.replace(rule, (match: string, lead?: string) =>
      typeof lead === 'string' && match.startsWith(lead) && rule.source.startsWith('(^|') ? `${lead}${MASK}` : MASK,
    );
  }
  // Les masques collés (« ••• ••• ») sont fusionnés pour rester lisibles.
  text = text.replace(new RegExp(`(?:${MASK}\\s*){2,}`, 'g'), `${MASK} `).trim();
  return { text, masked: text !== normalizeDigits(input).trim() };
}
