import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { catchError, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/http';
import { LangService } from '../core/lang.service';
import { UI } from '../shared/ui';

const SCHOOLS = ['SUP’COM', 'ENIT', 'INSAT', 'ESPRIT', 'ISI', 'FST', 'ENSI', 'IHEC', 'ENIS', 'ISG', 'Autre'];

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, ...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="wrap auth">
    <div class="side2 studs">
      <h2>{{ (role() === 'tuteur' ? 'auth.sideTutorT' : 'auth.sideT') | transloco }}</h2>
      <ul>
        @if (role() === 'tuteur') {
          <li><app-icon name="circle-check" /> {{ 'auth.tside1' | transloco }}</li>
          <li><app-icon name="circle-check" /> {{ 'auth.tside2' | transloco }}</li>
          <li><app-icon name="circle-check" /> {{ 'auth.tside3' | transloco }}</li>
        } @else {
          <li><app-icon name="circle-check" /> {{ 'auth.side1' | transloco }}</li>
          <li><app-icon name="circle-check" /> {{ 'auth.side2' | transloco }}</li>
          <li><app-icon name="circle-check" /> {{ 'auth.side3' | transloco }}</li>
        }
      </ul>
    </div>

    <form class="card form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <h1>{{ 'auth.registerT' | transloco }}</h1>
      <div class="roles" role="radiogroup" [attr.aria-label]="'auth.iam' | transloco">
        <button type="button" role="radio" class="role" [attr.aria-checked]="role() === 'etudiant'" (click)="setRole('etudiant')">
          <app-icon name="graduation-cap" /><b>{{ 'auth.student' | transloco }}</b><span class="small muted">{{ 'auth.studentD' | transloco }}</span></button>
        <button type="button" role="radio" class="role" [attr.aria-checked]="role() === 'tuteur'" (click)="setRole('tuteur')">
          <app-icon name="book-open" /><b>{{ 'auth.tutor' | transloco }}</b><span class="small muted">{{ 'auth.tutorD' | transloco }}</span></button>
      </div>

      <div class="two">
        <div class="fld"><label for="r-first">{{ 'auth.firstName' | transloco }}</label><input id="r-first" formControlName="firstName" autocomplete="given-name" /></div>
        <div class="fld"><label for="r-last">{{ 'auth.lastName' | transloco }}</label><input id="r-last" formControlName="lastName" autocomplete="family-name" /></div>
      </div>
      <div class="fld">
        <label for="r-email">{{ 'auth.email' | transloco }}</label>
        <input id="r-email" type="email" formControlName="email" autocomplete="email" dir="ltr" [attr.aria-invalid]="bad('email')" />
        @if (bad('email')) { <div class="err">{{ 'auth.emailErr' | transloco }}</div> }
      </div>
      <div class="fld">
        <label for="r-pass">{{ 'auth.password' | transloco }}</label>
        <input id="r-pass" type="password" formControlName="password" autocomplete="new-password" aria-describedby="r-pass-h" [attr.aria-invalid]="bad('password')" />
        <div class="hint" id="r-pass-h">{{ 'auth.passHint' | transloco }}</div>
      </div>
      <div class="two">
        <div class="fld"><label for="r-school">{{ 'auth.school' | transloco }}</label>
          <select id="r-school" formControlName="school">@for (s of schools; track s) { <option [value]="s">{{ s }}</option> }</select></div>
        <div class="fld"><label for="r-year">{{ 'auth.year' | transloco }}</label>
          <select id="r-year" formControlName="year">@for (y of years; track y) { <option [value]="y">{{ y }}</option> }</select></div>
      </div>

      @if (role() === 'tuteur') {
        <div class="fld">
          <label for="r-avg">{{ 'auth.average' | transloco }}</label>
          <input id="r-avg" type="number" min="10" max="20" step="0.01" formControlName="declaredAverage" aria-describedby="r-avg-h" [attr.aria-invalid]="bad('declaredAverage')" />
          <div class="hint" id="r-avg-h">{{ 'auth.averageHint' | transloco }}</div>
        </div>
        <div class="fld"><label for="r-bio">{{ 'auth.bio' | transloco }}</label><textarea id="r-bio" formControlName="bio" maxlength="600"></textarea></div>
        <fieldset formArrayName="subjects">
          <legend>{{ 'auth.subjectsT' | transloco }}</legend>
          @for (g of subjects.controls; track g; let i = $index) {
            <div class="subj-row" [formGroupName]="i">
              <div class="fld" style="margin:0"><label class="sr-only" [for]="'r-sub-' + i">{{ 'search.subject' | transloco }}</label>
                <select [id]="'r-sub-' + i" formControlName="code">@for (s of allSubjects(); track s.code) { <option [value]="s.code">{{ s | subject }}</option> }</select></div>
              <div class="fld" style="margin:0"><label class="sr-only" [for]="'r-pr-' + i">{{ 'auth.pricePerHour' | transloco }}</label>
                <input [id]="'r-pr-' + i" type="number" min="5" max="100" formControlName="pricePerHourDt" [attr.aria-label]="'auth.pricePerHour' | transloco" /></div>
              <button type="button" class="btn sm ghost" (click)="subjects.removeAt(i)" [disabled]="subjects.length === 1" [attr.aria-label]="'common.remove' | transloco"><app-icon name="trash-2" /></button>
            </div>
          }
          <button type="button" class="linkbtn small" (click)="addSubject()"><app-icon name="plus" /> {{ 'auth.addSubject' | transloco }}</button>
        </fieldset>
      }

      @if (error()) { <div class="alert err" role="alert"><app-icon name="triangle-alert" /> {{ error() }}</div> }
      <button class="btn block" type="submit" [disabled]="busy()">@if (busy()) { <app-icon name="loader-circle" /> } {{ 'auth.registerBtn' | transloco }}</button>
      <p class="small muted center">{{ 'auth.haveAccount' | transloco }} <a routerLink="/connexion">{{ 'nav.login' | transloco }}</a></p>
    </form>
  </div>`,
  styleUrl: './auth.scss',
})
export class RegisterPage implements OnInit {
  readonly roleParam = input<string>(undefined, { alias: 'role' });
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly lang = inject(LangService);
  private readonly router = inject(Router);
  protected readonly schools = SCHOOLS;
  protected readonly years = ['1re année', '2e année', '3e année', '4e année', '5e année', 'Master'];
  protected readonly allSubjects = toSignal(inject(ApiService).subjects().pipe(catchError(() => of([]))), { initialValue: [] });
  protected readonly role = signal<'etudiant' | 'tuteur'>('etudiant');
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
  protected get subjects(): FormArray { return this.form.controls.subjects; }

  constructor() {
    this.lang.setTitle('auth.registerT');
  }

  ngOnInit(): void {
    if (this.roleParam() === 'tuteur') this.role.set('tuteur');
  }

  private subjectGroup(code = 'probabilites') {
    return this.fb.nonNullable.group({ code: [code, Validators.required], pricePerHourDt: [20, [Validators.required, Validators.min(5), Validators.max(100)]] });
  }

  setRole(r: 'etudiant' | 'tuteur'): void { this.role.set(r); }
  addSubject(): void { this.subjects.push(this.subjectGroup(this.allSubjects()[this.subjects.length]?.code ?? 'probabilites')); }

  bad(name: 'email' | 'password' | 'declaredAverage'): boolean {
    const c = this.form.controls[name];
    return c.invalid && c.touched;
  }

  submit(): void {
    const tutor = this.role() === 'tuteur';
    if (!tutor) { this.subjects.disable(); this.form.controls.declaredAverage.disable(); }
    else { this.subjects.enable(); this.form.controls.declaredAverage.enable(); }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Vérifie les champs du formulaire : mot de passe de 8 caractères avec un chiffre, e-mail valide.');
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.auth
      .register({
        role: this.role(), firstName: v.firstName.trim(), lastName: v.lastName.trim(), email: v.email.trim(), password: v.password,
        school: v.school, year: v.year, lang: this.lang.lang(),
        ...(tutor ? { declaredAverage: Number(v.declaredAverage), bio: v.bio, subjects: v.subjects.map((s) => ({ code: s.code, pricePerHourDt: Number(s.pricePerHourDt) })) } : {}),
      })
      .subscribe({
        next: (s) => void this.router.navigateByUrl(this.auth.homeFor(s.user.role)),
        error: (e) => { this.busy.set(false); this.error.set(errorMessage(e)); },
      });
  }
}
