import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, input, model, viewChildren } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

/**
 * Onglets accessibles (rôle tablist, flèches du clavier) avec un indicateur qui glisse
 * jusqu'à l'onglet actif. Les panneaux sont rendus par la page.
 */
@Component({
  selector: 'app-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="dtabs" role="tablist" [attr.aria-label]="label()" (keydown)="keys($event)">
    @for (t of tabs(); track t.id) {
      <button
        #tab
        type="button"
        role="tab"
        [id]="'tab-' + t.id"
        [attr.aria-selected]="active() === t.id"
        [attr.aria-controls]="'panel-' + t.id"
        [tabindex]="active() === t.id ? 0 : -1"
        (click)="active.set(t.id)"
      >
        {{ t.label }}
        @if (t.count) {
          <span class="cnt">{{ t.count }}</span>
        }
      </button>
    }
    <span class="ink" aria-hidden="true"></span>
  </div>`,
  styles: `
    .dtabs { position: relative; }
    .dtabs button[aria-selected='true'] { box-shadow: none; }
    .ink { position: absolute; bottom: 0; height: 2px; background: var(--bleu); border-radius: 2px; left: 0; width: 0;
      transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), width 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
  `,
})
export class TabsComponent {
  readonly tabs = input.required<TabItem[]>();
  readonly active = model.required<string>();
  readonly label = input('');
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tab');

  constructor() {
    // Déplace l'indicateur sous l'onglet actif (et après un changement de langue ou de taille).
    afterRenderEffect(() => {
      const idx = this.tabs().findIndex((t) => t.id === this.active());
      const btn = this.buttons()[idx]?.nativeElement;
      const ink = btn?.parentElement?.querySelector<HTMLElement>('.ink');
      if (!btn || !ink) return;
      ink.style.width = `${btn.offsetWidth}px`;
      ink.style.transform = `translateX(${btn.offsetLeft}px)`;
    });
  }

  /** Flèches gauche/droite (inversées en arabe), Début, Fin. */
  protected keys(e: KeyboardEvent): void {
    const ids = this.tabs().map((t) => t.id);
    const i = ids.indexOf(this.active());
    const rtl = document.documentElement.dir === 'rtl';
    const step = e.key === 'ArrowRight' ? (rtl ? -1 : 1) : e.key === 'ArrowLeft' ? (rtl ? 1 : -1) : 0;
    let next = i;
    if (step) next = (i + step + ids.length) % ids.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ids.length - 1;
    else return;
    e.preventDefault();
    this.active.set(ids[next]);
    this.buttons()[next]?.nativeElement.focus();
  }
}
