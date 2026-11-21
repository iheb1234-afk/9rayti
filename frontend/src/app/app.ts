import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { environment } from '../environments/environment';
import { IconComponent } from './components/icon/icon.component';
import { AuthService } from './core/auth/auth.service';
import { FooterComponent } from './layout/footer/footer.component';
import { HeaderComponent } from './layout/header/header.component';
import { ToastHostComponent } from './layout/toast-host/toast-host.component';

/** Coquille de l'application : en-tête, page courante, pied de page, notifications. */
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    TranslocoPipe,
    IconComponent,
    HeaderComponent,
    FooterComponent,
    ToastHostComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly auth = inject(AuthService);
  protected readonly demo = environment.demo;

  constructor() {
    // Rafraîchit le solde de crédits et le statut du compte à chaque changement de page.
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.auth.refresh());
  }

  /** Lien d'évitement : place le focus clavier directement sur le contenu. */
  protected focusMain(event: Event): void {
    event.preventDefault();
    document.getElementById('contenu')?.focus();
  }
}
