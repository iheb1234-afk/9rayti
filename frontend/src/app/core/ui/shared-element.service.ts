import { Injectable, signal } from '@angular/core';

/**
 * Transition « élément partagé » : on retient le dernier tuteur ouvert pour que son avatar
 * porte le même nom de transition (view-transition-name) sur la carte et sur le profil.
 * Le navigateur anime alors l'avatar d'une page à l'autre, dans les deux sens.
 */
@Injectable({ providedIn: 'root' })
export class SharedElementService {
  readonly tutorId = signal<string | null>(null);

  /** Appelé au clic : pose le nom tout de suite sur l'élément (avant la capture de l'ancienne page). */
  markTutor(id: string, avatar: HTMLElement | null): void {
    document
      .querySelectorAll<HTMLElement>('[style*="view-transition-name: tutor-avatar"]')
      .forEach((el) => (el.style.viewTransitionName = ''));
    if (avatar) avatar.style.viewTransitionName = 'tutor-avatar';
    this.tutorId.set(id);
  }
}
