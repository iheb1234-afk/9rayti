import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UI } from '../../components';
import { ToastService } from '../../core/ui/toast.service';

/** Zone d'affichage des notifications courtes, lue par les lecteurs d'écran. */
@Component({
  selector: 'app-toast-host',
  imports: [...UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="toasts" aria-live="polite" aria-atomic="false">
    @for (t of toasts.items(); track t.id) {
      <div class="toast" [class.err]="t.kind === 'err'" role="status">
        <app-icon
          [name]="t.kind === 'err' ? 'triangle-alert' : t.kind === 'info' ? 'info' : 'circle-check'"
        />
        <span>{{ t.text }}</span>
        <button type="button" class="x" (click)="toasts.dismiss(t.id)" aria-label="Fermer">
          <app-icon name="x" />
        </button>
      </div>
    }
  </div>`,
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);
}
