import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AvatarComponent } from '../avatar/avatar.component';
import { IconComponent } from '../icon/icon.component';

/**
 * Choix d'une photo de profil. L'image est recadrée au centre et réduite à 256 × 256 (WebP)
 * dans le navigateur avant l'envoi : quelques dizaines de ko au lieu de plusieurs Mo
 * (idée reprise de Talmidon).
 */
@Component({
  selector: 'app-avatar-upload',
  imports: [AvatarComponent, IconComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="au">
    <app-avatar [name]="name()" [photo]="preview() ?? photo()" [size]="96" />
    <div class="acts">
      <label class="btn sm alt" [class.busy]="busy()">
        <app-icon name="upload" /> {{ 'profile.photoChange' | transloco }}
        <input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" (change)="pick($event)" />
      </label>
      @if (photo() || preview()) {
        <button type="button" class="btn sm ghost" (click)="remove.emit(); preview.set(null)"><app-icon name="trash-2" /> {{ 'profile.photoRemove' | transloco }}</button>
      }
      <span class="small muted">{{ 'profile.photoHint' | transloco }}</span>
    </div>
  </div>`,
  styles: `
    .au { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
    .acts { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    label { cursor: pointer; }
    label:focus-within { box-shadow: var(--focus); }
    .busy { opacity: 0.6; pointer-events: none; }
  `,
})
export class AvatarUploadComponent {
  readonly name = input.required<string>();
  readonly photo = input<string | null>(null);
  readonly busy = input(false);
  readonly picked = output<string>();
  readonly remove = output<void>();
  protected readonly preview = signal<string | null>(null);

  protected async pick(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const dataUrl = await this.resize(file, 256);
    this.preview.set(dataUrl);
    this.picked.emit(dataUrl);
  }

  /** Recadrage carré au centre, puis réduction ; WebP si le navigateur sait l'encoder, sinon JPEG. */
  private async resize(file: File, size: number): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
    const webp = canvas.toDataURL('image/webp', 0.85);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85);
  }
}
