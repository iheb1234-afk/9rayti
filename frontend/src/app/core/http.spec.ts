import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { errorMessage, guestGuard, roleGuard } from './http';

describe('Gardes de routes', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  });
  const run = (guard: ReturnType<typeof roleGuard>, url = '/mon-espace') =>
    TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));

  it('renvoie vers la connexion un visiteur non connecté, en gardant la page demandée', () => {
    const r = run(roleGuard('etudiant')) as UrlTree;
    expect(r.toString()).toBe('/connexion?next=%2Fmon-espace');
  });

  it('renvoie un tuteur vers son propre espace s’il ouvre l’espace étudiant', () => {
    localStorage.setItem('9rayti.session', JSON.stringify({ token: 't', user: { role: 'tuteur', firstName: 'Sarra' } }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    expect((run(roleGuard('etudiant')) as UrlTree).toString()).toBe('/espace-tuteur');
    expect(TestBed.inject(AuthService).loggedIn()).toBeTrue();
    expect((TestBed.runInInjectionContext(() => guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as UrlTree).toString()).toBe('/espace-tuteur');
  });
});

describe('Messages d’erreur', () => {
  it('reprend le message de l’API', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 400, error: { message: 'Solde insuffisant' } }))).toBe('Solde insuffisant');
    expect(errorMessage(new HttpErrorResponse({ status: 400, error: { message: ['a', 'b'] } }))).toBe('a · b');
  });
  it('explique quand le serveur est injoignable', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }))).toContain('serveur');
  });
});
