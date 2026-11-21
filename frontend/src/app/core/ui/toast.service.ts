import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'err' | 'info';
}

/** Notifications courtes en bas de l'écran, annoncées aux lecteurs d'écran (aria-live). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly items = signal<Toast[]>([]);
  private seq = 0;

  show(text: string, kind: Toast['kind'] = 'ok', durationMs = 4500): void {
    const id = ++this.seq;
    this.items.update((list) => [...list.slice(-3), { id, text, kind }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }
}
