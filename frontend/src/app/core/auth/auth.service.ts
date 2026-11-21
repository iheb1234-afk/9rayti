import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiService, RegisterPayload } from '../api/api.service';
import { Role, Session, User } from '../api/models';

const KEY = '9rayti.session';

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** Session de l'utilisateur, exposée en signals (jeton JWT conservé dans le navigateur). */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly session = signal<Session | null>(read());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly loggedIn = computed(() => this.session() !== null);
  readonly role = computed<Role | null>(() => this.user()?.role ?? null);

  login(email: string, password: string): Observable<Session> {
    return this.api.login(email, password).pipe(tap((s) => this.store(s)));
  }

  register(body: RegisterPayload): Observable<Session> {
    return this.api.register(body).pipe(tap((s) => this.store(s)));
  }

  /** Recharge le profil (solde de crédits, statut tuteur) après une action. */
  refresh(): void {
    if (!this.token()) return;
    this.api.me().subscribe({ next: (user) => this.patch(user), error: () => undefined });
  }

  patch(user: User): void {
    const s = this.session();
    if (s) this.store({ ...s, user });
  }

  logout(redirect = true): void {
    this.session.set(null);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* navigation privée */
    }
    if (redirect) void this.router.navigateByUrl('/');
  }

  /** Page d'accueil propre à chaque type de compte. */
  homeFor(role: Role | null): string {
    return role === 'tuteur' ? '/espace-tuteur' : role === 'admin' ? '/admin' : '/mon-espace';
  }

  private store(s: Session): void {
    this.session.set(s);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* navigation privée */
    }
  }
}
