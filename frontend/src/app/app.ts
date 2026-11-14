import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthService } from './core/auth.service';
import { LangService } from './core/lang.service';
import { Lang } from './core/models';
import { DtPipe, IconComponent, LogoComponent, ToastService } from './shared/ui';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe, IconComponent, LogoComponent, DtPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly lang = inject(LangService);
  protected readonly toasts = inject(ToastService);
  protected readonly menuOpen = signal(false);
  protected readonly demo = environment.demo;
  protected readonly langs: { code: Lang; label: string; name: string }[] = [
    { code: 'fr', label: 'FR', name: 'Français' },
    { code: 'ar', label: 'ع', name: 'العربية' },
    { code: 'en', label: 'EN', name: 'English' },
  ];
  protected readonly year = new Date().getFullYear();

  constructor() {
    inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.menuOpen.set(false);
      // Rafraîchit le solde et le statut à chaque navigation d'un utilisateur connecté.
      this.auth.refresh();
    });
  }

  protected focusMain(event: Event): void {
    event.preventDefault();
    document.getElementById('contenu')?.focus();
  }
}
