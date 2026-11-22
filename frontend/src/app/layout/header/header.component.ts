import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { UI } from '../../components';
import { NotificationBellComponent } from '../../components/notification-bell/notification-bell.component';
import { ThemeToggleComponent } from '../../components/theme-toggle/theme-toggle.component';
import { ApiService } from '../../core/api/api.service';
import { Lang } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { LangService } from '../../core/i18n/lang.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { PaletteService } from '../../core/ui/palette.service';
import { CountUpDirective } from '../../directives/count-up.directive';
import { MagneticDirective } from '../../directives/magnetic.directive';
import { DtPipe } from '../../pipes/dt.pipe';

/**
 * En-tête collant et translucide : navigation, recherche rapide, langue, thème, et pour un
 * compte connecté : crédits, messages, notifications, menu du compte. Sur mobile, le menu
 * s'ouvre en cercle depuis le bouton.
 */
@Component({
  selector: 'app-header',
  imports: [
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    ...UI,
    NotificationBellComponent,
    ThemeToggleComponent,
    CountUpDirective,
    MagneticDirective,
  ],
  providers: [DtPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
  protected readonly api = inject(ApiService);
  protected readonly lang = inject(LangService);
  protected readonly notifs = inject(NotificationsService);
  protected readonly palette = inject(PaletteService);
  private readonly dt = inject(DtPipe);
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly menuOpen = signal(false);
  protected readonly userMenu = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly money = (m: number) => this.dt.transform(m);
  protected readonly langs: { code: Lang; label: string; name: string }[] = [
    { code: 'fr', label: 'FR', name: 'Français' },
    { code: 'ar', label: 'ع', name: 'العربية' },
    { code: 'en', label: 'EN', name: 'English' },
  ];

  constructor() {
    // Les menus se referment à chaque changement de page.
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.menuOpen.set(false);
        this.userMenu.set(false);
      });
  }

  @HostListener('window:scroll')
  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 8);
  }

  @HostListener('document:click', ['$event'])
  protected outside(e: MouseEvent): void {
    const menu = (this.host.nativeElement as HTMLElement).querySelector('.um');
    if (this.userMenu() && menu && !menu.contains(e.target as Node)) this.userMenu.set(false);
  }

  @HostListener('document:keydown.escape')
  protected escape(): void {
    this.userMenu.set(false);
    this.menuOpen.set(false);
  }
}
