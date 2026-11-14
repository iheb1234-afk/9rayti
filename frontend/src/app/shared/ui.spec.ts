import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { LangService } from '../core/lang.service';
import { remaining } from './state-badge.component';
import { DtPipe, NumPipe, WhenPipe } from './ui';

describe('Formatage selon la langue', () => {
  let lang: LangService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        provideTransloco({ config: { availableLangs: ['fr', 'ar', 'en'], defaultLang: 'fr' } }),
        DtPipe, NumPipe, WhenPipe,
      ],
    });
    lang = TestBed.inject(LangService);
  });

  it('affiche les millimes en dinars', () => {
    lang.use('fr', false);
    expect(TestBed.inject(DtPipe).transform(23000)).toBe('23 DT');
    lang.use('ar', false);
    expect(TestBed.inject(DtPipe).transform(23000)).toContain('د.ت');
  });

  it('écrit les notes avec la virgule en français, le point en anglais', () => {
    lang.use('fr', false);
    expect(TestBed.inject(NumPipe).transform(4.8)).toBe('4,8');
    lang.use('en', false);
    expect(TestBed.inject(NumPipe).transform(4.8)).toBe('4.8');
  });

  it('bascule la page en droite-à-gauche pour l’arabe', () => {
    lang.use('ar', false);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    lang.use('fr', false);
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('affiche l’heure de Tunis sur 24 h', () => {
    lang.use('fr', false);
    expect(TestBed.inject(WhenPipe).transform('2026-11-15T19:00:00Z', 'time')).toBe('20:00');
  });
});

describe('Compte à rebours des 12 h', () => {
  it('donne les heures et minutes restantes, ou null une fois expiré', () => {
    const now = Date.parse('2026-11-14T20:00:00Z');
    expect(remaining('2026-11-15T07:30:00Z', now)).toEqual({ h: 11, m: 30 });
    expect(remaining('2026-11-14T19:59:00Z', now)).toBeNull();
  });
});
