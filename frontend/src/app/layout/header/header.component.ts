import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { UI } from '../../components';
import { Lang } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { LangService } from '../../core/i18n/lang.service';

/** En-tête collant : navigation, langue, compte. Se replie en menu sur mobile. */
@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
  protected readonly lang = inject(LangService);
  protected readonly menuOpen = signal(false);
  protected readonly langs: { code: Lang; label: string; name: string }[] = [
    { code: 'fr', label: 'FR', name: 'Français' },
    { code: 'ar', label: 'ع', name: 'العربية' },
    { code: 'en', label: 'EN', name: 'English' },
  ];

  constructor() {
    // Le menu mobile se referme à chaque changement de page.
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.menuOpen.set(false));
  }
}
