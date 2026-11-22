import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { UI } from '../../components';
import { AvatarUploadComponent } from '../../components/avatar-upload/avatar-upload.component';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { ShareProfileComponent } from '../../components/share-profile/share-profile.component';
import { ThemeToggleComponent } from '../../components/theme-toggle/theme-toggle.component';
import { ApiService } from '../../core/api/api.service';
import { Lang } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/http/error-message';
import { LangService } from '../../core/i18n/lang.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { ThemeService } from '../../core/theme/theme.service';
import { ToastService } from '../../core/ui/toast.service';
import { RevealDirective } from '../../directives/reveal.directive';

const SCHOOLS = [
  'SUP’COM',
  'ENIT',
  'INSAT',
  'ESPRIT',
  'ISI',
  'FST',
  'ENSI',
  'IHEC',
  'ENIS',
  'ISG',
  'Autre',
];

/** Mon profil (sitemap : étudiant « Mon profil », tuteur « Profil, vérification »). */
@Component({
  selector: 'app-profile-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    PageHeaderComponent,
    AvatarUploadComponent,
    ShareProfileComponent,
    ThemeToggleComponent,
    RevealDirective,
    ...UI,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  protected readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  protected readonly lang = inject(LangService);
  protected readonly theme = inject(ThemeService);
  private readonly notifs = inject(NotificationsService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(TranslocoService);
  private readonly fb = inject(FormBuilder);
  protected readonly schools = SCHOOLS;
  protected readonly years = [
    '1re année',
    '2e année',
    '3e année',
    '4e année',
    '5e année',
    'Master',
  ];
  protected readonly langs: { code: Lang; name: string }[] = [
    { code: 'fr', name: 'Français' },
    { code: 'ar', name: 'العربية' },
    { code: 'en', name: 'English' },
  ];
  protected readonly busy = signal<string | null>(null);
  protected readonly permission = signal<string>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  /** Profil public du tuteur (bio, langues, statut de vérification). */
  protected readonly tutor = rxResource({
    params: () => this.auth.role(),
    stream: ({ params }) => (params === 'tuteur' ? this.api.tutorProfile() : of(null)),
  });
  protected readonly tutorLangs = signal<Lang[]>([]);
  protected bio = '';

  protected readonly info = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(40)]],
    lastName: ['', [Validators.required, Validators.maxLength(40)]],
    school: ['', Validators.required],
    year: [''],
  });
  protected readonly pwd = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/\d/)]],
  });
  protected readonly since = computed(() => this.auth.user()?.createdAt ?? null);

  constructor() {
    this.lang.setTitle('nav.profile');
    effect(() => {
      const u = this.auth.user();
      if (u && !this.info.dirty)
        this.info.reset({
          firstName: u.firstName,
          lastName: u.lastName,
          school: u.school,
          year: u.year,
        });
    });
    effect(() => {
      const t = this.tutor.value();
      if (t) {
        this.bio = t.bio;
        this.tutorLangs.set(t.languages);
      }
    });
  }

  protected saveInfo(): void {
    if (this.info.invalid) return this.info.markAllAsTouched();
    this.busy.set('info');
    this.api.updateMe(this.info.getRawValue()).subscribe({
      next: (u) => this.done('info', () => (this.auth.patch(u), this.info.markAsPristine())),
      error: (e) => this.fail(e),
    });
  }

  protected setPhoto(dataUrl: string): void {
    this.busy.set('photo');
    this.api.setAvatar(dataUrl).subscribe({
      next: (u) => this.done('photo', () => this.auth.patch(u)),
      error: (e) => this.fail(e),
    });
  }

  protected removePhoto(): void {
    this.busy.set('photo');
    this.api.removeAvatar().subscribe({
      next: (u) => this.done('photo', () => this.auth.patch(u)),
      error: (e) => this.fail(e),
    });
  }

  protected toggleLang(code: Lang): void {
    const set = new Set(this.tutorLangs());
    if (set.has(code) && set.size > 1) set.delete(code);
    else set.add(code);
    this.tutorLangs.set([...set]);
  }

  protected saveTutor(): void {
    this.busy.set('tutor');
    this.api.updateTutorProfile({ bio: this.bio, languages: this.tutorLangs() }).subscribe({
      next: () => this.done('tutor', () => this.tutor.reload()),
      error: (e) => this.fail(e),
    });
  }

  protected changePassword(): void {
    if (this.pwd.invalid) return this.pwd.markAllAsTouched();
    const { currentPassword, newPassword } = this.pwd.getRawValue();
    this.busy.set('pwd');
    this.api.changePassword(currentPassword, newPassword).subscribe({
      next: () => this.done('pwd', () => this.pwd.reset()),
      error: (e) => this.fail(e),
    });
  }

  protected async enableNotifications(): Promise<void> {
    this.permission.set(await this.notifs.enableBrowserNotifications());
  }

  private done(what: string, after: () => void): void {
    this.busy.set(null);
    after();
    this.toast.show(this.i18n.translate(`profile.saved.${what}`));
  }

  private fail(e: unknown): void {
    this.busy.set(null);
    this.toast.show(errorMessage(e), 'err');
  }
}
