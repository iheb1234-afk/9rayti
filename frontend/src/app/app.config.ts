import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { LangService } from './core/i18n/lang.service';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { lazyDemoInterceptor } from './demo/lazy-demo.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Sans zone.js : les signals disent à Angular quoi redessiner (moins de JavaScript, moins de travail).
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      // Transitions animées entre les pages (API View Transitions du navigateur).
      withViewTransitions({ skipInitialTransition: true }),
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors(environment.demo ? [authInterceptor, lazyDemoInterceptor] : [authInterceptor]),
    ),
    provideTransloco({
      config: {
        availableLangs: ['fr', 'ar', 'en'],
        defaultLang: 'fr',
        fallbackLang: 'fr',
        missingHandler: { useFallbackTranslation: true },
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    // La langue (et sa traduction) est chargée avant le premier affichage : pas de texte qui saute.
    provideAppInitializer(() => inject(LangService).init()),
  ],
};
