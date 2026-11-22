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
      // Filet de sécurité : si le navigateur ne démarre pas la transition à temps (vu sous
      // WebKit), on la saute ; la page change quand même, sans animation.
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition }) => {
          const timer = setTimeout(() => transition.skipTransition(), 800);
          const clear = () => clearTimeout(timer);
          transition.updateCallbackDone.then(clear, clear);
        },
      }),
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors(
        environment.demo ? [authInterceptor, lazyDemoInterceptor] : [authInterceptor],
      ),
    ),
    provideTransloco({
      config: {
        availableLangs: ['fr', 'ar', 'en'],
        defaultLang: 'fr',
        fallbackLang: 'fr',
        // Les trois fichiers ont exactement les mêmes clés (vérifié) : pas de second fichier à charger.
        missingHandler: { useFallbackTranslation: false },
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    // La langue (et sa traduction) est chargée avant le premier affichage : pas de texte qui saute.
    provideAppInitializer(() => inject(LangService).init()),
  ],
};
