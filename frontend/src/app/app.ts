import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { environment } from '../environments/environment';
import { CommandPaletteComponent } from './components/command-palette/command-palette.component';
import { IconComponent } from './components/icon/icon.component';
import { RouteProgressComponent } from './components/route-progress/route-progress.component';
import { AuthService } from './core/auth/auth.service';
import { reducedMotion } from './core/motion/motion';
import { FooterComponent } from './layout/footer/footer.component';
import { HeaderComponent } from './layout/header/header.component';
import { ToastHostComponent } from './layout/toast-host/toast-host.component';

/** Coquille de l'application : en-tête, page courante, pied de page, notifications, recherche rapide. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TranslocoPipe, IconComponent, HeaderComponent, FooterComponent, ToastHostComponent, CommandPaletteComponent, RouteProgressComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { '(document:pointerdown)': 'ripple($event)' },
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

  /** Onde au clic sur tous les boutons de la charte (.btn), sans rien ajouter dans chaque page. */
  protected ripple(e: PointerEvent): void {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>('.btn');
    if (!btn || reducedMotion()) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const ink = document.createElement('span');
    ink.className = 'ripple';
    ink.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    btn.appendChild(ink);
    ink.addEventListener('animationend', () => ink.remove(), { once: true });
  }
}
