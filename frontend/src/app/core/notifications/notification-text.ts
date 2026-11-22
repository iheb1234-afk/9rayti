import { AppNotification, Lang } from '../api/models';

/** Paramètres d'une notification, avec la matière dans la langue active. */
export function notificationParams(n: AppNotification, lang: Lang, money: (millimes: number) => string): Record<string, string | number> {
  const p = n.params;
  const subject = (lang === 'ar' ? p['subjectAr'] : lang === 'en' ? p['subjectEn'] : p['subjectFr']) ?? '';
  return { ...p, subject, amount: typeof p['amount'] === 'number' ? money(p['amount']) : (p['amount'] ?? '') };
}

/** Icône associée à chaque type de notification. */
export const NOTIFICATION_ICON: Record<AppNotification['type'], string> = {
  demande_recue: 'inbox',
  demande_acceptee: 'circle-check',
  demande_refusee: 'circle-x',
  demande_expiree: 'hourglass',
  cours_annule: 'circle-x',
  cours_termine: 'star',
  avis_recu: 'star',
  versement: 'wallet',
  signalement: 'flag',
  signalement_traite: 'shield-check',
  message: 'message-square',
  session_reservee: 'users',
  session_annulee: 'calendar',
  tuteur_valide: 'badge-check',
  contact: 'mail',
};
