/**
 * Copie, pour le mode démo, de la règle anti-fuite de l'API (backend/src/messages/contact-masking.ts) :
 * numéros, e-mails, liens et messageries sont remplacés par « ••• » avant d'enregistrer un message.
 */
const MASK = '•••';

function normalizeDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

const RULES: RegExp[] = [
  /[\w.+-]+\s*(?:@|\[at\]|\(at\)|\s+at\s+)\s*[\w-]+\s*(?:\.|\[dot\]|\(dot\)|\s+dot\s+)\s*[a-z]{2,}/gi,
  /\b(?:https?:\/\/|www\.)\S+/gi,
  /\b(?:wa\.me|t\.me|m\.me|fb\.me|bit\.ly|linktr\.ee|instagram\.com|facebook\.com|tiktok\.com|snapchat\.com)\/?\S*/gi,
  /\b(?:whats?\s?app|watsap+|wtsp|insta(?:gram)?|facebook|fb|messenger|telegram|snap(?:chat)?|viber|tiktok|discord)\b/gi,
  /(?:واتس\s?اب|واتساب|انستقرام|انستغرام|فيسبوك|فايسبوك|ماسنجر|تيليغرام|تلغرام|سناب)/g,
  /(^|[^\w])@[a-z0-9_.]{3,}/gi,
  /(?:\+|00)?\d(?:[\s.\-/]*\d){7,}/g,
];

export function maskContactInfo(input: string): { text: string; masked: boolean } {
  let text = normalizeDigits(input);
  for (const rule of RULES) {
    text = text.replace(rule, (match: string, lead?: string) =>
      typeof lead === 'string' && match.startsWith(lead) && rule.source.startsWith('(^|')
        ? `${lead}${MASK}`
        : MASK,
    );
  }
  text = text.replace(new RegExp(`(?:${MASK}\\s*){2,}`, 'g'), `${MASK} `).trim();
  return { text, masked: text !== normalizeDigits(input).trim() };
}
