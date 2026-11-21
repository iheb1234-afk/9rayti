import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../api/api.service';
import { Lang, Subject } from '../api/models';
import { AuthService } from '../auth/auth.service';

const KEY = '9rayti.lang';
const LOCALES: Record<Lang, string> = { fr: 'fr-TN', ar: 'ar-TN', en: 'en-GB' };

/**
 * Langue de l'interface : français, arabe ou anglais.
 * L'arabe bascule toute la page de droite à gauche (attribut dir sur <html>).
 */
@Injectable({ providedIn: 'root' })
export class LangService {
  private readonly transloco = inject(TranslocoService);
  private readonly doc = inject(DOCUMENT);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly title = inject(Title);
  readonly lang = signal<Lang>('fr');

  /**
   * Choisit la langue (profil, puis choix mémorisé, puis navigateur) et attend son fichier
   * de traduction : le premier affichage est donc complet, sans texte qui apparaît après coup.
   */
  init(): Promise<unknown> {
    let saved: Lang | null = null;
    try {
      saved = localStorage.getItem(KEY) as Lang | null;
    } catch {
      /* navigation privée : on ignore */
    }
    const fromUser = this.auth.user()?.lang;
    const browser = (navigator.language || 'fr').slice(0, 2) as Lang;
    const initial = fromUser ?? saved ?? (['fr', 'ar', 'en'].includes(browser) ? browser : 'fr');
    this.use(initial, false);
    return firstValueFrom(this.transloco.load(initial)).catch(() => undefined);
  }

  use(lang: Lang, persist = true): void {
    this.lang.set(lang);
    this.transloco.setActiveLang(lang);
    const html = this.doc.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* navigation privée : on ignore */
    }
    if (persist && this.auth.loggedIn()) {
      this.api.setLang(lang).subscribe({ next: (u) => this.auth.patch(u), error: () => undefined });
    }
  }

  /** Locale Intl utilisée pour les dates et les nombres. */
  locale(): string {
    return LOCALES[this.lang()];
  }

  subjectName(s: Pick<Subject, 'nameFr' | 'nameAr' | 'nameEn'> | null | undefined): string {
    if (!s) return '';
    return this.lang() === 'ar' ? s.nameAr : this.lang() === 'en' ? s.nameEn : s.nameFr;
  }

  /** Titre de l'onglet, traduit : « Trouver un tuteur · 9rayti ». */
  setTitle(key: string, params?: Record<string, unknown>): void {
    const t = this.transloco.translate(key, params);
    this.title.setTitle(`${t} · 9rayti`);
  }
}
