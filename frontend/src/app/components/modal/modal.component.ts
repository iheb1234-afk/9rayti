import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Fenêtre modale accessible, basée sur l'élément natif <dialog> : le focus est piégé,
 * Échap ferme, l'arrière-plan est inerte. Ouverture animée (voir styles.scss).
 */
@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<dialog #dlg class="modal" [attr.aria-labelledby]="id + '-t'" (close)="closed.emit()" (click)="backdrop($event)">
    <div class="mbody">
      <div class="mhead">
        <h2 class="h3" [id]="id + '-t'">{{ title() }}</h2>
        <button type="button" class="x" (click)="close()" aria-label="Fermer"><app-icon name="x" /></button>
      </div>
      <ng-content />
    </div>
  </dialog>`,
  styles: `
    .mhead { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
    .h3 { font-size: 19px; }
    .x { border: 0; background: var(--fond); border-radius: 50%; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; color: var(--texte); flex: none; }
    .x:hover { background: var(--chaux); }
  `,
})
export class ModalComponent {
  readonly title = input.required<string>();
  readonly closed = output<void>();
  protected readonly id = `m${Math.random().toString(36).slice(2, 8)}`;
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  open(): void {
    this.dlg().nativeElement.showModal();
  }

  close(): void {
    this.dlg().nativeElement.close();
  }

  /** Un clic sur le fond assombri ferme la fenêtre. */
  protected backdrop(e: MouseEvent): void {
    if (e.target === this.dlg().nativeElement) this.close();
  }
}
