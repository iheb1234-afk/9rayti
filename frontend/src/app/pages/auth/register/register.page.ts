import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { catchError, of } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { errorMessage } from '../../../core/http/error-message';
import { LangService } from '../../../core/i18n/lang.service';
import { UI } from '../../../components/index';

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

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.page.html',
  styleUrl: '../auth.scss',
})
export class RegisterPage implements OnInit {
  /** ?role=tuteur dans l'URL pré-sélectionne le type de compte. */
  readonly role = input<string>();
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly lang = inject(LangService);
  private readonly router = inject(Router);
  protected readonly schools = SCHOOLS;
  protected readonly years = [
    '1re année',
    '2e année',
    '3e année',
    '4e année',
    '5e année',
    'Master',
  ];
  protected readonly allSubjects = toSignal(
    inject(ApiService)
      .subjects()
      .pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  protected readonly selectedRole = signal<'etudiant' | 'tuteur'>('etudiant');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(40)]],
    lastName: ['', [Validators.required, Validators.maxLength(40)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/\d/)]],
    school: [SCHOOLS[0], Validators.required],
    year: ['2e année', Validators.required],
    declaredAverage: [15, [Validators.min(10), Validators.max(20)]],
    bio: [''],
    subjects: this.fb.array([this.subjectGroup()]),
  });
  protected get subjects(): FormArray {
    return this.form.controls.subjects;
  }

  constructor() {
    this.lang.setTitle('auth.registerT');
  }

  ngOnInit(): void {
    if (this.role() === 'tuteur') this.selectedRole.set('tuteur');
  }

  private subjectGroup(code = 'probabilites') {
    return this.fb.nonNullable.group({
      code: [code, Validators.required],
      pricePerHourDt: [20, [Validators.required, Validators.min(5), Validators.max(100)]],
    });
  }

  setRole(r: 'etudiant' | 'tuteur'): void {
    this.selectedRole.set(r);
  }
  addSubject(): void {
    this.subjects.push(
      this.subjectGroup(this.allSubjects()[this.subjects.length]?.code ?? 'probabilites'),
    );
  }

  bad(name: 'email' | 'password' | 'declaredAverage'): boolean {
    const c = this.form.controls[name];
    return c.invalid && c.touched;
  }

  submit(): void {
    const tutor = this.selectedRole() === 'tuteur';
    if (!tutor) {
      this.subjects.disable();
      this.form.controls.declaredAverage.disable();
    } else {
      this.subjects.enable();
      this.form.controls.declaredAverage.enable();
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(
        'Vérifie les champs du formulaire : mot de passe de 8 caractères avec un chiffre, e-mail valide.',
      );
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.auth
      .register({
        role: this.selectedRole(),
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        email: v.email.trim(),
        password: v.password,
        school: v.school,
        year: v.year,
        lang: this.lang.lang(),
        ...(tutor
          ? {
              declaredAverage: Number(v.declaredAverage),
              bio: v.bio,
              subjects: v.subjects.map((s) => ({
                code: s.code,
                pricePerHourDt: Number(s.pricePerHourDt),
              })),
            }
          : {}),
      })
      .subscribe({
        next: (s) => void this.router.navigateByUrl(this.auth.homeFor(s.user.role)),
        error: (e) => {
          this.busy.set(false);
          this.error.set(errorMessage(e));
        },
      });
  }
}
