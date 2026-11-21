import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { errorMessage } from '../../../core/http/error-message';
import { LangService } from '../../../core/i18n/lang.service';
import { UI } from '../../../components/index';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.page.html',
  styleUrl: '../auth.scss',
})
export class LoginPage {
  readonly next = input<string>();
  readonly expired = input<string>();
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  constructor() {
    inject(LangService).setTitle('auth.loginT');
  }

  invalid(name: 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && c.touched;
  }

  fill(email: string): void {
    this.form.setValue({ email, password: 'demo1234' });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email.trim(), password).subscribe({
      next: (s) => {
        const next = this.next();
        void this.router.navigateByUrl(
          next && next.startsWith('/') && !next.startsWith('//')
            ? next
            : this.auth.homeFor(s.user.role),
        );
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }
}
