import { Injectable, signal } from '@angular/core';

/** Ouverture de la recherche rapide (Ctrl+K), depuis le clavier ou le bouton de l'en-tête. */
@Injectable({ providedIn: 'root' })
export class PaletteService {
  readonly open = signal(false);
}
