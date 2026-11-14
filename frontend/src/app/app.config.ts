import { HttpClient, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, Injectable, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { authInterceptor } from './core/http';
import { LangService } from './core/lang.service';
import { demoInterceptor } from './demo/demo.interceptor';

/** Fichiers de traduction servis depuis public/i18n (chemin relatif : fonctionne aussi sous GitHub Pages). */
@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);
  getTranslation(lang: string) {
    return this.http.get<Translation>(`i18n/${lang}.json`);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      withViewTransitions(),
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors(environment.demo ? [authInterceptor, demoInterceptor] : [authInterceptor]),
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
    provideAppInitializer(() => inject(LangService).init()),
  ],
};
