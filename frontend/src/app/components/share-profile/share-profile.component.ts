import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../icon/icon.component';
import { ModalComponent } from '../modal/modal.component';

/**
 * Partager un profil de tuteur : lien à copier, WhatsApp, et QR code à afficher en amphi
 * (bibliothèque chargée seulement à l'ouverture). Idée reprise de Talmidon.
 */
@Component({
  selector: 'app-share-profile',
  imports: [ModalComponent, IconComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button" class="btn sm ghost" (click)="open()">
      <app-icon name="send" /> {{ 'share.button' | transloco }}
    </button>
    <app-modal #modal [title]="'share.title' | transloco: { name: name() }">
      <div class="share">
        <canvas
          #qr
          width="220"
          height="220"
          class="qr"
          role="img"
          [attr.aria-label]="'share.qr' | transloco"
        ></canvas>
        <div class="row link">
          <input
            class="in"
            [value]="url()"
            readonly
            [attr.aria-label]="'share.link' | transloco"
            (focus)="$any($event.target).select()"
          />
          <button type="button" class="btn sm" (click)="copy()">
            <app-icon [name]="copied() ? 'check' : 'file-text'" />
            {{ (copied() ? 'share.copied' : 'share.copy') | transloco }}
          </button>
        </div>
        <a class="btn sm alt" target="_blank" rel="noopener" [href]="whatsapp()"
          ><app-icon name="message-square" /> WhatsApp</a
        >
      </div>
    </app-modal>`,
  styles: `
    .share {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }
    .qr {
      border-radius: 14px;
      border: 1px solid var(--trait);
      background: #fff;
      padding: 8px;
      width: 220px;
      height: 220px;
    }
    .link {
      width: 100%;
      flex-wrap: nowrap;
    }
    .in {
      flex: 1;
      min-width: 0;
      border: 1px solid var(--trait);
      border-radius: 10px;
      padding: 9px 12px;
      background: var(--fond);
      font: inherit;
      font-size: 14px;
      color: var(--texte);
    }
  `,
})
export class ShareProfileComponent {
  readonly name = input.required<string>();
  readonly path = input.required<string>();
  protected readonly copied = signal(false);
  private readonly modal = viewChild.required<ModalComponent>('modal');
  private readonly qr = viewChild.required<ElementRef<HTMLCanvasElement>>('qr');

  protected url(): string {
    return new URL(this.path().replace(/^\//, ''), document.baseURI).toString();
  }

  protected whatsapp(): string {
    return `https://wa.me/?text=${encodeURIComponent(`${this.name()} — 9rayti : ${this.url()}`)}`;
  }

  protected async open(): Promise<void> {
    this.copied.set(false);
    this.modal().open();
    const QR = await import('qrcode');
    await QR.toCanvas(this.qr().nativeElement, this.url(), {
      width: 204,
      margin: 1,
      color: { dark: '#0B3C78', light: '#ffffff' },
    });
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url());
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }
}
